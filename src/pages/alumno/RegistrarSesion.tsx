import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { llamarFuncion } from '../../lib/api'
import { cargarCuerpo, formatoKcal, kcalSesion, type DatosCuerpo } from '../../lib/calorias'
import { notificar } from '../../lib/push'
import { mensajeError } from '../../lib/consultas'
import { DIAS, diaSemana } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRitmo, leerDuracion, leerNumero } from '../../lib/formato'
import type { Molestia, SesionPlan, SesionReg, Split } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { BotonCompartir, imagenDeSesion } from '../../components/Compartir'
import { useZapatillas } from '../../components/salud/Zapatillas'
import { compararVuelta, kmReps, textoDistanciaRep, textoReps } from '../../lib/intervalos'
import { ObjetivosSesion, useTipos } from '../../components/Semana'
import { AreaTexto, Boton, Campo, Cargando, EtiquetaTipo, MensajeError, Opciones, Pestanas, Tarjeta } from '../../components/ui'

type DatosGarmin = {
  link: string
  titulo: string | null
  desnivel_m: number | null
  distancia_km: number
  duracion_seg: number
  ritmo_prom_seg: number
  fc_prom: number | null
  fc_max: number | null
  splits: Split[]
  datos_crudos: unknown
}

// Acepta el link solo o el mensaje entero que comparte la app de Garmin.
const linkGarmin = (texto: string) => {
  const id = texto.match(/garmin\.com\/[^\s]*?activity\/(\d{6,})/i)?.[1]
  return id ? `https://connect.garmin.com/modern/activity/${id}` : null
}

const SENSACIONES = [
  { valor: 1, texto: '1 · Muy mal' },
  { valor: 2, texto: '2 · Mal' },
  { valor: 3, texto: '3 · Normal' },
  { valor: 4, texto: '4 · Bien' },
  { valor: 5, texto: '5 · Excelente' },
]

export default function RegistrarSesion() {
  const { sesionId } = useParams()
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const [sesion, setSesion] = useState<SesionPlan | null | undefined>(undefined)
  const [existente, setExistente] = useState<SesionReg | null>(null)
  const [modo, setModo] = useState<'garmin' | 'manual'>('garmin')

  // Formulario
  const [distancia, setDistancia] = useState('')
  const [tiempo, setTiempo] = useState('')
  const [fcProm, setFcProm] = useState('')
  const [fcMax, setFcMax] = useState('')
  const [repsHechas, setRepsHechas] = useState('')
  const [vuelta, setVuelta] = useState('')
  const [calKm, setCalKm] = useState('')
  const [calMin, setCalMin] = useState('')
  const [aflKm, setAflKm] = useState('')
  const [aflMin, setAflMin] = useState('')
  // Calentamiento y afloje: también con su link de Garmin y su pulso.
  const [calLink, setCalLink] = useState('')
  const [calFcp, setCalFcp] = useState('')
  const [calFcm, setCalFcm] = useState('')
  const [aflLink, setAflLink] = useState('')
  const [aflFcp, setAflFcp] = useState('')
  const [aflFcm, setAflFcm] = useState('')
  const [calorias, setCalorias] = useState('')
  const [cuerpo, setCuerpo] = useState<DatosCuerpo | null>(null)
  const [sensacion, setSensacion] = useState<number | null>(null)
  const [molestia, setMolestia] = useState<Molestia | null>(null)
  const [comentario, setComentario] = useState('')
  const { lista: zapatillas } = useZapatillas(alumno.id)
  const [calzado, setCalzado] = useState<string | null | undefined>(undefined) // undefined = la principal

  // Garmin
  const [link, setLink] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [garmin, setGarmin] = useState<DatosGarmin | null>(null)

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    cargarCuerpo(alumno.id).then(setCuerpo)
  }, [alumno.id])

  useEffect(() => {
    ;(async () => {
      const [s, r] = await Promise.all([
        supabase.from('sesiones_planificadas').select('*').eq('id', sesionId!).maybeSingle(),
        supabase.from('sesiones_registradas').select('*').eq('sesion_planificada_id', sesionId!).maybeSingle(),
      ])
      const plan = s.data as SesionPlan | null
      setSesion(plan)
      const reg = r.data as SesionReg | null
      if (plan?.reps) setRepsHechas(String(reg?.reps_hechas ?? plan.reps))
      if (reg?.rep_prom_seg) setVuelta(formatoDuracion(reg.rep_prom_seg))
      setExistente(reg)
      if (reg) {
        setDistancia(reg.distancia_km ? String(reg.distancia_km).replace('.', ',') : '')
        setTiempo(reg.duracion_seg ? formatoDuracion(reg.duracion_seg) : '')
        setFcProm(reg.fc_prom ? String(reg.fc_prom) : '')
        setFcMax(reg.fc_max ? String(reg.fc_max) : '')
        const txt = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '')
        setCalKm(txt(reg.calentamiento_km))
        setCalMin(txt(reg.calentamiento_min))
        setAflKm(txt(reg.afloje_km))
        setAflMin(txt(reg.afloje_min))
        setCalorias(reg.calorias ? String(reg.calorias) : '')
        setCalLink(reg.calentamiento_garmin_url ?? '')
        setCalFcp(reg.calentamiento_fc_prom ? String(reg.calentamiento_fc_prom) : '')
        setCalFcm(reg.calentamiento_fc_max ? String(reg.calentamiento_fc_max) : '')
        setAflLink(reg.afloje_garmin_url ?? '')
        setAflFcp(reg.afloje_fc_prom ? String(reg.afloje_fc_prom) : '')
        setAflFcm(reg.afloje_fc_max ? String(reg.afloje_fc_max) : '')
        setSensacion(reg.sensacion)
        setComentario(reg.comentario_alumno ?? '')
        setCalzado(reg.calzado_id ?? null)
        if (reg.garmin_url) setLink(reg.garmin_url)
        else setModo('manual')
        const m = await supabase.from('molestias_ciclo').select('nivel').eq('sesion_registrada_id', reg.id).maybeSingle()
        setMolestia((m.data?.nivel as Molestia) ?? null)
      }
    })()
  }, [sesionId])

  const enUso = (zapatillas ?? []).filter((z) => !z.retirada)
  const calzadoElegido = calzado === undefined ? (enUso.find((z) => z.principal)?.id ?? null) : calzado

  // Pista / series: con repeticiones hechas y vuelta promedio salen la distancia y el tiempo (sin recuperación).
  const conReps = !!(sesion?.reps && sesion.rep_m)
  function cambiarReps(n: string, v: string) {
    setRepsHechas(n)
    setVuelta(v)
    const cant = leerNumero(n)
    const seg = leerDuracion(v)
    if (cant && sesion?.rep_m) setDistancia(String(kmReps(cant, sesion.rep_m)).replace('.', ','))
    if (cant && seg) setTiempo(formatoDuracion(Math.round(cant * seg)))
  }

  const km = leerNumero(distancia)
  // Calentamiento y afloje: suman km, pero no cambian el ritmo de la parte principal.
  const extraKm = (t: string) => (t.trim() ? leerNumero(t) : null)
  const extraMin = (t: string) => (t.trim() ? leerNumero(t) : null)
  const totalKm = (km ?? 0) + (extraKm(calKm) ?? 0) + (extraKm(aflKm) ?? 0)
  const seg = leerDuracion(tiempo)
  const ritmo = km && seg ? Math.round(seg / km) : null
  const estimadas =
    cuerpo && km && seg
      ? kcalSesion(
          { fecha: '', distancia_km: km, duracion_seg: seg, fc_prom: leerNumero(fcProm), calentamiento_km: extraKm(calKm), calentamiento_min: extraMin(calMin), afloje_km: extraKm(aflKm), afloje_min: extraMin(aflMin), calentamiento_fc_prom: calFcp ? leerNumero(calFcp) : null, afloje_fc_prom: aflFcp ? leerNumero(aflFcp) : null },
          cuerpo,
        ).kcal
      : null

  // Lee el resumen de Garmin y completa el formulario. El pulso no viene
  // (Garmin no lo comparte en el link público): se carga a mano si se quiere.
  async function leerGarmin(texto = link) {
    setError('')
    setGarmin(null)
    if (!linkGarmin(texto)) return setError('Pegá el link (o el mensaje) que comparte Garmin Connect.')
    setLeyendo(true)
    const r = await llamarFuncion<DatosGarmin>('leer-garmin', { url: texto.trim() })
    setLeyendo(false)
    if (r.error !== null) return setError(r.error)
    setGarmin(r.datos)
    if (conReps) return
    setDistancia(String(r.datos.distancia_km).replace('.', ','))
    setTiempo(formatoDuracion(r.datos.duracion_seg))
  }

  async function guardar() {
    setError('')
    if (!km || km <= 0) return setError('Ingresá la distancia.')
    if (!seg || seg <= 0) return setError('Ingresá el tiempo, por ejemplo 52:30 o 1:05:10.')
    if (!sensacion) return setError('Elegí cómo te sentiste.')
    if (conReps && repsHechas.trim() && leerNumero(repsHechas) === null) return setError('Escribí cuántas repeticiones hiciste.')
    for (const [v, nombre] of [[calKm, 'los km del calentamiento'], [calMin, 'los minutos del calentamiento'], [aflKm, 'los km del afloje'], [aflMin, 'los minutos del afloje']] as const) {
      const n = v.trim() ? leerNumero(v) : null
      if (v.trim() && (!n || n <= 0)) return setError(`Revisá ${nombre}: tiene que ser un número mayor a cero.`)
    }
    for (const [v, nombre] of [[calFcp, 'el pulso promedio del calentamiento'], [calFcm, 'el pulso máximo del calentamiento'], [aflFcp, 'el pulso promedio del afloje'], [aflFcm, 'el pulso máximo del afloje']] as const) {
      const n = v.trim() ? leerNumero(v) : null
      if (v.trim() && (!n || n < 40 || n > 240)) return setError(`Revisá ${nombre}: va entre 40 y 240.`)
    }
    const extrasParte = {
      calentamiento_garmin_url: linkGarmin(calLink),
      calentamiento_fc_prom: calFcp ? leerNumero(calFcp) : null,
      calentamiento_fc_max: calFcm ? leerNumero(calFcm) : null,
      afloje_garmin_url: linkGarmin(aflLink),
      afloje_fc_prom: aflFcp ? leerNumero(aflFcp) : null,
      afloje_fc_max: aflFcm ? leerNumero(aflFcm) : null,
    }
    const habiaParte = existente && (existente.calentamiento_garmin_url || existente.calentamiento_fc_prom || existente.calentamiento_fc_max || existente.afloje_garmin_url || existente.afloje_fc_prom || existente.afloje_fc_max)
    // El link se guarda siempre que haya uno, aunque no se haya podido leer:
    // el entrenador lo abre para ver la actividad completa.
    const url = linkGarmin(link)
    const fila = {
      sesion_planificada_id: sesionId,
      alumno_id: alumno.id,
      origen: garmin || (url && existente?.origen === 'garmin') ? 'garmin' : 'manual',
      garmin_url: url,
      distancia_km: Math.round(km * 100) / 100,
      duracion_seg: seg,
      ritmo_prom_seg: ritmo,
      fc_prom: leerNumero(fcProm),
      fc_max: leerNumero(fcMax),
      reps_hechas: conReps && repsHechas.trim() ? Math.round(leerNumero(repsHechas) ?? 0) : null,
      rep_prom_seg: conReps ? leerDuracion(vuelta) : null,
      calentamiento_km: extraKm(calKm) ? Math.round(extraKm(calKm)! * 100) / 100 : null,
      calentamiento_min: extraMin(calMin) ? Math.round(extraMin(calMin)!) : null,
      afloje_km: extraKm(aflKm) ? Math.round(extraKm(aflKm)! * 100) / 100 : null,
      afloje_min: extraMin(aflMin) ? Math.round(extraMin(aflMin)!) : null,
      splits: existente?.splits ?? [],
      datos_crudos: garmin ? garmin.datos_crudos : undefined,
      sensacion,
      comentario_alumno: comentario.trim() || null,
      calzado_id: calzadoElegido,
      // Solo si se cargó (así no falla si la base todavía no tiene la columna).
      ...(calorias || existente?.calorias ? { calorias: calorias ? Math.round(leerNumero(calorias) ?? 0) || null : null } : {}),
      ...(Object.values(extrasParte).some((v) => v !== null) || habiaParte ? extrasParte : {}),
    }
    setGuardando(true)
    try {
      const q = existente
        ? supabase.from('sesiones_registradas').update(fila).eq('id', existente.id).select('id').single()
        : supabase.from('sesiones_registradas').insert(fila).select('id').single()
      const { data, error } = await q
      if (error) throw error
      const regId = (data as { id: string }).id
      if (alumno.sexo === 'F') {
        if (molestia) {
          const { error: e2 } = await supabase.from('molestias_ciclo').upsert({ sesion_registrada_id: regId, alumno_id: alumno.id, nivel: molestia })
          if (e2) throw e2
        } else {
          await supabase.from('molestias_ciclo').delete().eq('sesion_registrada_id', regId)
        }
      }
      if (!existente) notificar({ tipo: 'sesion', sesion_planificada_id: sesionId! })
      setListo(true)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  if (sesion === undefined) return <Cargando pantalla />
  if (sesion === null)
    return (
      <Pantalla titulo="Registrar sesión" volver="/hoy">
        <MensajeError>No se encontró la sesión planificada.</MensajeError>
      </Pantalla>
    )

  if (listo)
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-6xl" aria-hidden="true">
          ✅
        </p>
        <h1 className="font-titulo text-2xl font-extrabold">¡Sesión guardada!</h1>
        <p className="text-texto-2">
          {formatoKm(km!)} km · {formatoDuracion(seg!)} · {formatoRitmo(ritmo!)}/km
        </p>
        <p className="text-texto-2">Tu entrenador ya la puede ver y evaluar.</p>
        <BotonCompartir
          variante="primario"
          className="w-full"
          nombreArchivo="rivero-entrenamiento.png"
          etiqueta="📤 Compartir mi entrenamiento"
          generar={(estilo) =>
            imagenDeSesion({
              estilo,
              planKm: sesion.distancia_km,
              registro: { reps_hechas: conReps ? leerNumero(repsHechas) : null, rep_prom_seg: conReps ? leerDuracion(vuelta) : null, rep_m: sesion.rep_m ?? null, fecha: sesion.fecha, distancia_km: km, calentamiento_km: extraKm(calKm), afloje_km: extraKm(aflKm), duracion_seg: seg, ritmo_prom_seg: ritmo, fc_prom: leerNumero(fcProm), sensacion, splits: garmin?.splits ?? existente?.splits ?? [], datos_crudos: garmin ? { desnivel_m: garmin.desnivel_m } : existente?.datos_crudos },
              tipo: tipo(sesion.tipo).nombre,
              titulo: sesion.resumen || tipo(sesion.tipo).nombre,
              nombre: alumno.nombre,
            })
          }
        />
        <Link to="/hoy" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-azul font-semibold text-white">
          Volver a Hoy
        </Link>
        <Link to="/semana" className="flex min-h-11 w-full items-center justify-center rounded-xl font-semibold text-azul">
          Ver mi semana
        </Link>
      </main>
    )

  const t = tipo(sesion.tipo)

  return (
    <Pantalla titulo={existente ? 'Editar sesión' : 'Registrar sesión'} volver="/hoy">
      <Tarjeta>
        <p className="text-sm text-texto-2">
          {DIAS[diaSemana(sesion.fecha)]} {formatoFecha(sesion.fecha)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <EtiquetaTipo nombre={t.nombre} color={t.color} />
          <span className="font-semibold">{sesion.resumen || t.nombre}</span>
        </div>
        <div className="mt-2">
          <ObjetivosSesion s={sesion} />
        </div>
      </Tarjeta>

      <Pestanas
        valor={modo}
        onChange={setModo}
        opciones={[
          { valor: 'garmin', texto: 'Link de Garmin' },
          { valor: 'manual', texto: 'Carga manual' },
        ]}
      />

      {modo === 'garmin' && (
        <Tarjeta className="flex flex-col gap-3">
          <p className="text-sm text-texto-2">
            En la app <strong>Garmin Connect</strong>: abrí la actividad → <strong>Compartir</strong> → <strong>Copiar</strong>. Después pegalo acá.
          </p>
          <AreaTexto
            id="garmin-link"
            label="Link o mensaje de Garmin"
            rows={2}
            placeholder="Consulta mi actividad… https://connect.garmin.com/modern/activity/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              // Al pegar, se lee solo.
              const pegado = e.clipboardData.getData('text')
              if (linkGarmin(pegado)) setTimeout(() => leerGarmin(pegado), 0)
            }}
          />
          <Boton variante="oscuro" onClick={() => leerGarmin()} disabled={leyendo}>
            {leyendo ? 'Leyendo…' : 'Leer'}
          </Boton>
          {garmin && (
            <div className="rounded-xl bg-ok/10 p-3 text-sm text-ok" role="status">
              <p className="font-semibold">✓ Leído de Garmin{garmin.titulo ? `: ${garmin.titulo}` : ''}</p>
              <p className="font-mono text-tinta">
                {formatoKm(garmin.distancia_km)} km · {formatoDuracion(garmin.duracion_seg)} · {formatoRitmo(garmin.ritmo_prom_seg)}/km
                {garmin.desnivel_m ? ` · ↑${garmin.desnivel_m} m` : ''}
              </p>
              <p className="mt-1 text-texto-2">Revisá los datos abajo. El pulso no viene en el link: si querés, cargalo a mano.</p>
            </div>
          )}
          <p className="text-xs text-texto-2">
            La actividad tiene que ser pública. Si no se puede leer, completá los datos abajo: el link queda guardado igual para tu entrenador.
          </p>
        </Tarjeta>
      )}

      {conReps && sesion && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-azul/30 bg-azul/5 p-3">
          <p className="font-semibold">🔁 Repeticiones</p>
          <p className="-mt-2 text-sm text-texto-2">
            Objetivo: <b className="text-tinta">{textoReps(sesion)}</b>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="reg-reps" label="¿Cuántas hiciste?" inputMode="numeric" value={repsHechas} onChange={(e) => cambiarReps(e.target.value.replace(/\D/g, '').slice(0, 3), vuelta)} />
            <Campo id="reg-vuelta" label={`Vuelta promedio (${textoDistanciaRep(sesion.rep_m!)})`} placeholder="1:46" inputMode="numeric" value={vuelta} onChange={(e) => cambiarReps(repsHechas, formatearTiempoTipeo(e.target.value))} />
          </div>
          {(() => {
            const prom = leerDuracion(vuelta)
            const c = prom ? compararVuelta(prom, sesion.rep_seg_min, sesion.rep_seg_max) : null
            if (!c) return null
            return (
              <p className={`text-sm font-semibold ${c === 'en_rango' ? 'text-ok' : 'text-[#9A6B00]'}`}>
                {c === 'en_rango' ? '✓ Dentro del objetivo' : c === 'rapido' ? '⚡ Más rápido que el objetivo' : '🐢 Más lento que el objetivo'}
              </p>
            )
          })()}
          <p className="text-xs text-texto-2">
            La distancia y el tiempo de abajo se calculan solos con tus repeticiones (sin contar la recuperación). Si hiciste algo distinto, corregilos.
            {garmin && ' El link de Garmin quedó guardado, pero su total incluye las recuperaciones: por eso no lo usamos para el ritmo.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo id="reg-km" label={conReps ? 'Distancia de las repeticiones (km)' : 'Distancia principal (km)'} inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} />
        <Campo id="reg-tiempo" label={conReps ? 'Tiempo sin recuperación' : 'Tiempo'} placeholder="52:30" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        <Campo id="reg-fcp" label="FC promedio" inputMode="numeric" value={fcProm} onChange={(e) => setFcProm(e.target.value.replace(/\D/g, ''))} />
        <Campo id="reg-fcm" label="FC máxima" inputMode="numeric" value={fcMax} onChange={(e) => setFcMax(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="text-sm" aria-live="polite">
        Ritmo: <strong className="font-mono">{ritmo ? `${formatoRitmo(ritmo)}/km` : '—'}</strong> <span className="text-texto-2">(se calcula solo)</span>
      </p>
      <Campo
        id="reg-kcal"
        label="🔥 Calorías (opcional, si tu reloj las muestra)"
        inputMode="numeric"
        placeholder={estimadas ? `≈ ${estimadas}` : ''}
        ayuda={estimadas && !calorias ? `Si lo dejás vacío, usamos un estimado: ≈ ${formatoKcal(estimadas)}.` : undefined}
        value={calorias}
        onChange={(e) => setCalorias(e.target.value.replace(/\D/g, '').slice(0, 5))}
      />

      <details className="rounded-2xl border border-borde bg-superficie p-3" open={!!(calKm || calMin || aflKm || aflMin || calLink || aflLink)}>
        <summary className="cursor-pointer font-semibold">🔥 Calentamiento y 🧊 afloje <span className="font-normal text-texto-2">(opcional)</span></summary>
        <p className="mt-1 text-xs text-texto-2">Si los hiciste aparte de la parte principal, cargalos acá: suman a tus km de la semana, pero no cambian el ritmo de la sesión.</p>
        <ParteExtra
          id="cal"
          titulo="🔥 Calentamiento"
          km={calKm}
          setKm={setCalKm}
          min={calMin}
          setMin={setCalMin}
          link={calLink}
          setLink={setCalLink}
          fcp={calFcp}
          setFcp={setCalFcp}
          fcm={calFcm}
          setFcm={setCalFcm}
        />
        <ParteExtra
          id="afl"
          titulo="🧊 Afloje / enfriamiento"
          km={aflKm}
          setKm={setAflKm}
          min={aflMin}
          setMin={setAflMin}
          link={aflLink}
          setLink={setAflLink}
          fcp={aflFcp}
          setFcp={setAflFcp}
          fcm={aflFcm}
          setFcm={setAflFcm}
        />
        {totalKm > (km ?? 0) && (
          <p className="mt-2 text-sm">
            Total corrido: <strong className="font-mono">{formatoKm(totalKm)} km</strong>
          </p>
        )}
      </details>

      <Opciones label="¿Cómo te sentiste?" valor={sensacion} onChange={setSensacion} opciones={SENSACIONES} />

      {enUso.length > 0 && (
        <Opciones
          label="👟 Zapatillas"
          valor={calzadoElegido ?? 'ninguna'}
          onChange={(v) => setCalzado(v === 'ninguna' ? null : v)}
          opciones={[...enUso.map((z) => ({ valor: z.id, texto: z.nombre })), { valor: 'ninguna', texto: 'Otras' }]}
        />
      )}

      {alumno.sexo === 'F' && (
        <div>
          <Opciones
            label="Molestias del ciclo hoy (opcional)"
            valor={molestia}
            onChange={(v) => setMolestia(v === molestia ? null : v)}
            opciones={[
              { valor: 'ninguna', texto: 'Ninguna', color: '#8A3B75' },
              { valor: 'leves', texto: 'Leves', color: '#8A3B75' },
              { valor: 'fuertes', texto: 'Fuertes', color: '#8A3B75' },
            ]}
          />
          <p className="mt-1 text-xs text-texto-2">Tu entrenador lo ve solo si compartís tu ciclo.</p>
        </div>
      )}

      <AreaTexto id="reg-comentario" label="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar} disabled={guardando} className="min-h-12">
        {guardando ? 'Guardando…' : 'Guardar sesión'}
      </Boton>
    </Pantalla>
  )
}

// "146" → "1:46" mientras se tipea.
function formatearTiempoTipeo(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`
}

/** Calentamiento o afloje: km y minutos, link de Garmin (completa km y min) y pulso. */
function ParteExtra(p: {
  id: string
  titulo: string
  km: string
  setKm: (v: string) => void
  min: string
  setMin: (v: string) => void
  link: string
  setLink: (v: string) => void
  fcp: string
  setFcp: (v: string) => void
  fcm: string
  setFcm: (v: string) => void
}) {
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  async function leer() {
    setError('')
    setAviso('')
    if (!linkGarmin(p.link)) return setError('Pegá el link (o el mensaje) que comparte Garmin Connect.')
    setLeyendo(true)
    const r = await llamarFuncion<DatosGarmin>('leer-garmin', { url: p.link.trim() })
    setLeyendo(false)
    if (r.error !== null) return setError(r.error)
    p.setLink(r.datos.link)
    p.setKm(String(r.datos.distancia_km).replace('.', ','))
    p.setMin(String(Math.max(1, Math.round(r.datos.duracion_seg / 60))))
    setAviso(`✓ Leído: ${formatoKm(r.datos.distancia_km)} km en ${formatoDuracion(r.datos.duracion_seg)}. El pulso no viene en el link: cargalo a mano si querés.`)
  }

  const conGarmin = !!linkGarmin(p.link)
  return (
    <fieldset className="mt-3 flex flex-col gap-2 rounded-xl bg-fondo p-3">
      <legend className="sr-only">{p.titulo}</legend>
      <p className="font-semibold">{p.titulo}</p>
      <div className="flex items-end gap-2">
        <Campo id={`reg-${p.id}-link`} className="flex-1" label="Link de Garmin (opcional)" placeholder="https://connect.garmin.com/…" value={p.link} onChange={(e) => p.setLink(e.target.value)} />
        <Boton variante="borde" onClick={leer} disabled={leyendo || !p.link.trim()}>
          {leyendo ? 'Leyendo…' : 'Leer'}
        </Boton>
      </div>
      {aviso && <p className="text-sm font-semibold text-ok">{aviso}</p>}
      <MensajeError>{error}</MensajeError>
      <div className="grid grid-cols-2 gap-3">
        <Campo id={`reg-${p.id}-km`} label="Km" inputMode="decimal" value={p.km} onChange={(e) => p.setKm(e.target.value)} />
        <Campo id={`reg-${p.id}-min`} label="Minutos" inputMode="numeric" value={p.min} onChange={(e) => p.setMin(e.target.value.replace(/\D/g, ''))} />
        <Campo id={`reg-${p.id}-fcp`} label="FC promedio" inputMode="numeric" value={p.fcp} onChange={(e) => p.setFcp(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        <Campo id={`reg-${p.id}-fcm`} label="FC máxima" inputMode="numeric" value={p.fcm} onChange={(e) => p.setFcm(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </div>
      {conGarmin && !aviso && <p className="text-xs text-texto-2">Tocá Leer para completar los km y los minutos desde Garmin.</p>}
    </fieldset>
  )
}