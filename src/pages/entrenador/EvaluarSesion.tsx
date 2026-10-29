import { compararVuelta, textoTiempo } from '../../lib/intervalos'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { notificar } from '../../lib/push'
import { compararFc, compararRitmo, kmPlanificados } from '../../lib/calculos'
import { faseCompartida, infoDe, type RegistroCiclo } from '../../lib/ciclo'
import { DIAS, diaSemana } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoPpm, formatoRango, formatoRitmo } from '../../lib/formato'
import type { Alumno, Evaluacion, Resultado, SesionPlan, SesionReg } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { useTipos } from '../../components/Semana'
import { AreaTexto, Boton, Cargando, EtiquetaTipo, MensajeError, Tarjeta, Titulo } from '../../components/ui'
import { leerBloques } from '../../lib/pista'
import { ResumenPista } from '../../components/PistaVueltas'

const SENSACION = ['', 'Muy mal', 'Mal', 'Normal', 'Bien', 'Excelente']

export default function EvaluarSesion() {
  const { sesionId } = useParams()
  const navigate = useNavigate()
  const { tipo } = useTipos()
  const [datos, setDatos] = useState<{
    sesion: SesionPlan & { alumno_id: string }
    registro: SesionReg | null
    evaluacion: Evaluacion | null
    alumno: Alumno
    molestia: string | null
    ciclo: ReturnType<typeof faseCompartida>
  } | null>(null)
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { data: s } = await supabase.from('sesiones_planificadas').select('*, planes_semanales(alumno_id)').eq('id', sesionId!).maybeSingle()
      if (!s) return setError('No se encontró la sesión.')
      const alumnoId = (Array.isArray(s.planes_semanales) ? s.planes_semanales[0] : s.planes_semanales).alumno_id as string
      const [r, e, a] = await Promise.all([
        supabase.from('sesiones_registradas').select('*').eq('sesion_planificada_id', sesionId!).maybeSingle(),
        supabase.from('evaluaciones').select('*').eq('sesion_planificada_id', sesionId!).maybeSingle(),
        supabase.from('alumnos').select('*').eq('id', alumnoId).single(),
      ])
      const alumno = a.data as Alumno
      const registro = r.data as SesionReg | null
      let molestia: string | null = null
      let ciclo: ReturnType<typeof faseCompartida> = null
      // RLS: solo devuelve datos del ciclo si la alumna los comparte.
      if (alumno.sexo === 'F' && alumno.comparte_ciclo) {
        const [m, c, i] = await Promise.all([
          registro ? supabase.from('molestias_ciclo').select('nivel').eq('sesion_registrada_id', registro.id).maybeSingle() : Promise.resolve({ data: null }),
          supabase.from('ciclos_menstruales').select('id, fecha_inicio, fecha_fin').eq('alumno_id', alumnoId),
          infoDe(alumnoId),
        ])
        molestia = (m.data as { nivel: string } | null)?.nivel ?? null
        if (i) ciclo = faseCompartida((c.data ?? []) as RegistroCiclo[], i, s.fecha)
      }
      const evaluacion = e.data as Evaluacion | null
      setDatos({ sesion: { ...(s as SesionPlan), alumno_id: alumnoId }, registro, evaluacion, alumno, molestia, ciclo })
      setResultado(evaluacion?.resultado ?? (registro ? null : 'no_cumplio'))
      setComentario(evaluacion?.comentario ?? '')
    })()
  }, [sesionId])

  async function guardar() {
    if (!resultado) return setError('Elegí Cumplió, Parcial o No cumplió.')
    setGuardando(true)
    const { error } = await supabase
      .from('evaluaciones')
      .upsert({ sesion_planificada_id: sesionId, resultado, comentario: comentario.trim() || null, leida_at: null }, { onConflict: 'sesion_planificada_id' })
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    notificar({ tipo: 'evaluacion', sesion_planificada_id: sesionId! })
    navigate(-1)
  }

  if (!datos) return error ? <MensajeError>{error}</MensajeError> : <Cargando pantalla />
  const { sesion: s, registro: r, alumno, molestia, ciclo } = datos
  const t = tipo(s.tipo)
  const kmPlan = kmPlanificados(s)

  return (
    <Pantalla titulo="Evaluar sesión" subtitulo={`${alumno.nombre} · ${DIAS[diaSemana(s.fecha)]} ${formatoFecha(s.fecha)}`} volver={`/alumnos/${alumno.id}`}>
      <div className="grid grid-cols-2 gap-2">
        <Tarjeta className="p-3">
          <p className="mb-1 text-xs font-semibold uppercase text-texto-2">Plan</p>
          <EtiquetaTipo nombre={t.nombre} color={t.color} />
          <p className="mt-1 font-semibold">{s.resumen || t.nombre}</p>
          {kmPlan.km > 0 && (
            <p className="font-mono text-sm">
              {kmPlan.estimado ? '≈' : ''}
              {formatoKm(kmPlan.km)} km
            </p>
          )}
          {s.duracion_min && <p className="font-mono text-sm">{s.duracion_min} min</p>}
          {(s.ritmo_min_seg || s.ritmo_max_seg) && <p className="font-mono text-sm">{formatoRango(s.ritmo_min_seg, s.ritmo_max_seg)}/km</p>}
          {(s.fc_obj_min || s.fc_obj_max) && <p className="font-mono text-sm text-mal">❤ {formatoPpm(s.fc_obj_min, s.fc_obj_max)}</p>}
          {s.estructura && <p className="mt-1 text-xs text-texto-2">{s.estructura}</p>}
        </Tarjeta>
        <Tarjeta className="p-3">
          <p className="mb-1 text-xs font-semibold uppercase text-texto-2">Real</p>
          {r ? (
            <dl className="font-mono text-sm">
              <p className="mb-1 text-xs text-texto-2">{r.origen === 'garmin' ? 'Garmin' : 'Carga manual'}</p>
              {r.datos_crudos?.titulo && <p className="text-xs text-texto-2">“{r.datos_crudos.titulo}”</p>}
              {r.datos_crudos?.desnivel_m ? <p className="text-xs text-texto-2">↑ {r.datos_crudos.desnivel_m} m de desnivel</p> : null}
              {r.distancia_km && <p className="text-base font-semibold">{formatoKm(r.distancia_km)} km</p>}
              {r.reps_hechas != null && s.reps && (
                <p className={`font-semibold ${r.reps_hechas >= s.reps ? 'text-ok' : 'text-[#9A6B00]'}`}>
                  🔁 {r.reps_hechas}/{s.reps} repeticiones
                </p>
              )}
              {r.rep_prom_seg && (
                <p className={claseVuelta(compararVuelta(r.rep_prom_seg, s.rep_seg_min, s.rep_seg_max))}>
                  Vuelta prom. {textoTiempo(r.rep_prom_seg)}
                  {s.rep_seg_min || s.rep_seg_max ? <span className="text-texto-2"> · objetivo {formatoRango(s.rep_seg_min ?? null, s.rep_seg_max ?? null)}</span> : null}
                </p>
              )}
              {r.duracion_seg && <p>{formatoDuracion(r.duracion_seg)}</p>}
              <ResumenPista bloques={leerBloques(r.pista_bloques)} />
              {(r.calentamiento_km || r.calentamiento_min || r.calentamiento_garmin_url) && (
                <ParteRegistrada titulo="🔥 Calentamiento" km={r.calentamiento_km} min={r.calentamiento_min} fcp={r.calentamiento_fc_prom} fcm={r.calentamiento_fc_max} link={r.calentamiento_garmin_url} />
              )}
              {(r.afloje_km || r.afloje_min || r.afloje_garmin_url) && (
                <ParteRegistrada titulo="🧊 Afloje" km={r.afloje_km} min={r.afloje_min} fcp={r.afloje_fc_prom} fcm={r.afloje_fc_max} link={r.afloje_garmin_url} />
              )}
              {r.ritmo_prom_seg && (
                <p className={claseRitmo(compararRitmo(r.ritmo_prom_seg, s.ritmo_min_seg, s.ritmo_max_seg))}>{formatoRitmo(r.ritmo_prom_seg)}/km</p>
              )}
              {(r.fc_prom || r.fc_max) && (
                <p>
                  FC <span className={claseFc(compararFc(r.fc_prom, s.fc_obj_min, s.fc_obj_max))}>{r.fc_prom ?? '—'}</span> / {r.fc_max ?? '—'}
                  {compararFc(r.fc_prom, s.fc_obj_min, s.fc_obj_max) === 'alto' && <span className="block font-sans text-xs text-mal">pulso más alto que el objetivo</span>}
                  {compararFc(r.fc_prom, s.fc_obj_min, s.fc_obj_max) === 'bajo' && <span className="block font-sans text-xs text-mal">pulso más bajo que el objetivo</span>}
                  {compararFc(r.fc_prom, s.fc_obj_min, s.fc_obj_max) === 'en_rango' && <span className="block font-sans text-xs text-ok">pulso en rango</span>}
                </p>
              )}
              {!r.fc_prom && (s.fc_obj_min || s.fc_obj_max) && <p className="font-sans text-xs text-texto-2">No cargó el pulso.</p>}
            </dl>
          ) : (
            <p className="text-sm text-mal">No registró esta sesión.</p>
          )}
        </Tarjeta>
      </div>

      {r?.garmin_url && (
        <a
          href={r.garmin_url}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-marino bg-superficie px-4 font-semibold text-tinta hover:bg-marino hover:text-white"
        >
          Ver la actividad completa en Garmin Connect ↗
        </a>
      )}

      {r && r.splits?.length > 0 && (
        <Tarjeta className="overflow-x-auto p-3">
          <Titulo>Splits</Titulo>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-texto-2">
              <tr>
                <th className="py-1">Km</th>
                <th>Tiempo</th>
                <th>Ritmo</th>
                <th>FC</th>
                <th>Rango</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {r.splits.map((sp) => {
                const c = compararRitmo(sp.ritmo_seg, s.ritmo_min_seg, s.ritmo_max_seg)
                return (
                  <tr key={sp.km} className="border-t border-borde">
                    <td className="py-1">{sp.km}</td>
                    <td>{formatoDuracion(sp.tiempo_seg)}</td>
                    <td>{formatoRitmo(sp.ritmo_seg)}</td>
                    <td>{sp.fc ?? '—'}</td>
                    <td className={`font-sans text-xs font-semibold ${claseRitmo(c)}`}>
                      {c === 'en_rango' ? 'en rango' : c === 'lento' ? 'más lento' : c === 'rapido' ? 'más rápido' : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Tarjeta>
      )}

      {r && (
        <Tarjeta>
          <Titulo>Lo que dice {alumno.nombre.split(' ')[0]}</Titulo>
          {r.sensacion && (
            <p>
              Sensación: <strong>{r.sensacion}/5 · {SENSACION[r.sensacion]}</strong>
            </p>
          )}
          {r.comentario_alumno ? <p className="mt-1 text-texto-2">“{r.comentario_alumno}”</p> : <p className="text-sm text-texto-2">Sin comentario.</p>}
        </Tarjeta>
      )}

      {ciclo && (
        <p className="rounded-2xl bg-ciclo-fondo px-4 py-3 text-ciclo">
          Ciclo: día {ciclo.dia}{ciclo.fase ? ` · fase ${ciclo.fase}` :ciclo.enPeriodo ? ' · con período' : ''}
          {molestia ? ` · molestias ${molestia}` : ''} <span className="text-sm">(estimado)</span>
        </p>
      )}

      <fieldset>
        <legend className="mb-2 font-titulo text-lg font-extrabold">Resultado</legend>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['cumplio', 'Cumplió', 'bg-ok text-white'],
              ['parcial', 'Parcial', 'bg-parcial text-[#0B1B3A]'],
              ['no_cumplio', 'No cumplió', 'bg-mal text-white'],
            ] as const
          ).map(([valor, texto, clase]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={resultado === valor}
              onClick={() => setResultado(valor)}
              className={`min-h-14 rounded-xl border-2 font-bold ${resultado === valor ? `${clase} border-marino` : 'border-borde bg-superficie text-tinta'}`}
            >
              {texto}
            </button>
          ))}
        </div>
      </fieldset>
      <AreaTexto id="comentario-eval" label="Comentario para el alumno" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar evaluación'}
      </Boton>
    </Pantalla>
  )
}

const claseFc = (c: ReturnType<typeof compararFc>) => (c === 'en_rango' ? 'text-ok' : c ? 'text-mal' : '')
const claseRitmo = (c: ReturnType<typeof compararRitmo>) => (c === 'en_rango' ? 'text-ok' : c === 'lento' || c === 'rapido' ? 'text-mal' : '')

const claseVuelta = (c: ReturnType<typeof compararVuelta>) => (c === 'en_rango' ? 'font-semibold text-ok' : c ? 'font-semibold text-mal' : '')

/** Calentamiento o afloje registrado: km, minutos, pulso y link a Garmin. */
function ParteRegistrada({ titulo, km, min, fcp, fcm, link }: { titulo: string; km?: number | null; min?: number | null; fcp?: number | null; fcm?: number | null; link?: string | null }) {
  const pulso = fcp || fcm ? `FC ${[fcp, fcm].filter(Boolean).join(' / ')}${fcp && fcm ? ' (prom / máx)' : fcp ? ' prom' : ' máx'}` : null
  return (
    <p className="text-sm text-texto-2">
      {titulo} {[km ? `${formatoKm(km)} km` : null, min ? `${min} min` : null, pulso].filter(Boolean).join(' · ')}
      {link && (
        <>
          {' · '}
          <a href={link} target="_blank" rel="noreferrer" className="font-semibold text-azul underline">
            Garmin ↗
          </a>
        </>
      )}
    </p>
  )
}