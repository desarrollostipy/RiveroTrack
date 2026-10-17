import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { useMiAlumno } from '../../lib/alumno'
import { cargarSemanas } from '../../lib/consultas'
import { estadoDeuda } from '../../lib/calculos'
import { diasEntre, fechaLarga, hoyPY, lunesDe, nombreMes } from '../../lib/fechas'
import { formatoFecha, formatoGs, formatoKm, formatoRango } from '../../lib/formato'
import type { Competencia, Cuota, Evaluacion, Pago, SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { CuadritosSemana, TextoRegistro, useTipos } from '../../components/Semana'
import { Boton, Cargando, EtiquetaTipo, Logo, Semaforo, Tarjeta, Titulo } from '../../components/ui'
import { MiCiclo } from './MiCiclo'

type Feedback = Evaluacion & { sesiones_planificadas: { fecha: string; resumen: string | null; tipo: string } | null }

export default function Hoy() {
  const { salir } = useSesion()
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const [semana, setSemana] = useState<SemanaCompleta | null | undefined>(undefined)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [competencia, setCompetencia] = useState<Competencia | null>(null)
  const [cuotas, setCuotas] = useState<(Cuota & { pagos: Pago | null })[]>([])

  const cargar = useCallback(async () => {
    const [s, f, c, q] = await Promise.all([
      cargarSemanas({ alumnoId: alumno.id, desde: lunes, hasta: lunes }),
      supabase.from('evaluaciones').select('*, sesiones_planificadas(fecha, resumen, tipo)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('competencias').select('*').eq('alumno_id', alumno.id).gte('fecha', hoy).order('fecha').limit(1).maybeSingle(),
      supabase.from('cuotas').select('*, pagos(*)').eq('alumno_id', alumno.id).order('periodo', { ascending: false }).limit(6),
    ])
    setSemana(s[0] ?? null)
    setFeedback(f.data as Feedback | null)
    setCompetencia(c.data as Competencia | null)
    setCuotas((q.data ?? []) as (Cuota & { pagos: Pago | null })[])
  }, [alumno.id, lunes, hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Al verlo, el último feedback queda marcado como leído.
  useEffect(() => {
    if (feedback && !feedback.leida_at) supabase.rpc('marcar_evaluacion_leida', { p_evaluacion_id: feedback.id })
  }, [feedback])

  const fecha = fechaLarga(hoy)
  const deHoy = semana?.sesiones.filter((s) => s.fecha === hoy) ?? []

  return (
    <Pantalla
      titulo={`Hola, ${alumno.nombre.split(' ')[0]}`}
      subtitulo={fecha.charAt(0).toUpperCase() + fecha.slice(1)}
      derecha={<Logo className="h-12 w-16 text-[0.6rem]" />}
    >
      <AvisoCuota cuotas={cuotas} cuotaMensual={alumno.cuota_mensual} dia={alumno.dia_vencimiento} />

      {semana === undefined ? (
        <Cargando />
      ) : (
        <>
          <Link to="/semana" aria-label="Ver mi semana">
            <CuadritosSemana sesiones={semana?.sesiones ?? []} lunes={lunes} hoy={hoy} hayPlan={!!semana} />
          </Link>

          <Tarjeta className="border-azul">
            <Titulo>Hoy</Titulo>
            {!semana && <p className="text-texto-2">Tu entrenador todavía no publicó el plan de esta semana.</p>}
            {semana && deHoy.length === 0 && <p className="text-texto-2">Hoy es día de descanso. 😌</p>}
            <div className="flex flex-col gap-4">
              {deHoy.map((s) => {
                const t = tipo(s.tipo)
                return (
                  <div key={s.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {deHoy.length > 1 && <span className="text-xs text-texto-2">{s.turno === 1 ? 'Mañana' : 'Tarde'}</span>}
                      <EtiquetaTipo nombre={t.nombre} color={t.color} />
                    </div>
                    <p className="font-titulo text-2xl font-extrabold">{s.resumen || t.nombre}</p>
                    {(s.ritmo_min_seg || s.ritmo_max_seg) && (
                      <p className="font-mono">Ritmo {formatoRango(s.ritmo_min_seg, s.ritmo_max_seg)} /km</p>
                    )}
                    {s.distancia_km && !s.resumen?.includes('km') && <p className="font-mono text-sm">{formatoKm(s.distancia_km)} km</p>}
                    {s.estructura && <p className="text-texto-2">{s.estructura}</p>}
                    {s.notas && <p className="rounded-xl bg-fondo px-3 py-2 text-sm">📝 {s.notas}</p>}
                    {s.tipo !== 'descanso' &&
                      (s.registro ? (
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <TextoRegistro s={s} />
                          <Link to={`/registrar/${s.id}`} className="flex min-h-11 items-center rounded-xl px-3 font-semibold text-azul">
                            Editar
                          </Link>
                        </div>
                      ) : (
                        <Link
                          to={`/registrar/${s.id}`}
                          className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-azul font-semibold text-white hover:bg-azul-hover"
                        >
                          Registrar sesión
                        </Link>
                      ))}
                  </div>
                )
              })}
            </div>
          </Tarjeta>
        </>
      )}

      {feedback && (
        <Tarjeta>
          <Titulo>Último feedback</Titulo>
          <div className="flex flex-wrap items-center gap-2">
            <Semaforo resultado={feedback.resultado} />
            {feedback.sesiones_planificadas && (
              <span className="text-sm text-texto-2">
                {formatoFecha(feedback.sesiones_planificadas.fecha)} · {feedback.sesiones_planificadas.resumen || tipo(feedback.sesiones_planificadas.tipo).nombre}
              </span>
            )}
          </div>
          {feedback.comentario && <p className="mt-2">“{feedback.comentario}”</p>}
        </Tarjeta>
      )}

      {competencia && (
        <Tarjeta className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-texto-2">Próxima competencia</p>
            <p className="font-semibold">{competencia.nombre}</p>
            <p className="text-sm text-texto-2">{formatoFecha(competencia.fecha)}</p>
          </div>
          <p className="text-right">
            <span className="font-titulo text-3xl font-extrabold text-azul">{diasEntre(hoy, competencia.fecha)}</span>
            <span className="block text-xs text-texto-2">días</span>
          </p>
        </Tarjeta>
      )}

      {alumno.sexo === 'F' && <MiCiclo />}

      <Boton variante="borde" onClick={salir} className="mt-2 self-start">
        Salir
      </Boton>
    </Pantalla>
  )
}

function AvisoCuota({ cuotas, cuotaMensual, dia }: { cuotas: (Cuota & { pagos: Pago | null })[]; cuotaMensual: number; dia: number }) {
  const hoy = hoyPY()
  const [abierto, setAbierto] = useState(false)
  const deuda = estadoDeuda(cuotas, hoy)
  if (!deuda.vencidas.length) return null
  const primera = deuda.vencidas[0]
  const pagadas = cuotas.filter((c) => c.estado === 'pagada').slice(0, 3)
  return (
    <div className="rounded-2xl bg-mal text-white">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className="min-h-11 w-full px-4 py-3 text-left">
        <p className="font-semibold">
          {deuda.vencidas.length === 1
            ? `Cuota de ${nombreMes(primera.periodo).toLowerCase()} vencida · ${formatoGs(primera.monto)}`
            : `${deuda.vencidas.length} cuotas vencidas · ${formatoGs(deuda.total)}`}
        </p>
        <p className="text-sm opacity-90">
          Venció el {formatoFecha(primera.vencimiento)} · {abierto ? 'ocultar' : 'ver detalle'}
        </p>
      </button>
      {abierto && (
        <div className="rounded-b-2xl bg-white px-4 py-3 text-sm text-marino">
          <p>
            Cuota mensual: <strong className="font-mono">{formatoGs(cuotaMensual)}</strong> · vence el día {dia}
          </p>
          {pagadas.length > 0 && (
            <ul className="mt-2">
              {pagadas.map((c) => (
                <li key={c.id} className="text-ok">
                  ✓ {nombreMes(c.periodo)} pagada{c.pagos ? ` el ${formatoFecha(c.pagos.fecha)}` : ''}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-texto-2">Cuando tu entrenador registre el pago, se actualiza acá.</p>
        </div>
      )}
    </div>
  )
}
