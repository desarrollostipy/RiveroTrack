import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { useMiAlumno } from '../../lib/alumno'
import { cargarSemanas, semanasEnMemoria } from '../../lib/consultas'
import { estadoDeuda } from '../../lib/calculos'
import { diasEntre, fechaLarga, hoyPY, lunesDe, nombreMes } from '../../lib/fechas'
import { formatoFecha, formatoGs } from '../../lib/formato'
import type { Competencia, Cuota, Evaluacion, Pago, SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { CuadritosSemana, ObjetivosSesion, TextoRegistro, useTipos } from '../../components/Semana'
import { Avatar, Cargando, estadoVigente, EtiquetaTipo, GloboEstado, Semaforo, Tarjeta, Titulo } from '../../components/ui'
import { MiCiclo } from './MiCiclo'
import { AnunciosAlumno, InvitarNotificaciones } from '../../components/AnunciosAlumno'
import { BienestarHoy } from '../../components/salud/Bienestar'
import { AvisoZapatillas } from '../../components/salud/Zapatillas'

type Feedback = Evaluacion & { sesiones_planificadas: { fecha: string; resumen: string | null; tipo: string } | null }

export default function Hoy() {
  const { perfil } = useSesion()
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  // Lo último visto se muestra al instante mientras se actualiza.
  const [semana, setSemana] = useState<SemanaCompleta | null | undefined>(() => {
    const g = semanasEnMemoria({ alumnoId: alumno.id, desde: lunes, hasta: lunes })
    return g ? (g[0] ?? null) : undefined
  })
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [competencia, setCompetencia] = useState<Competencia | null>(null)
  const [cuotas, setCuotas] = useState<(Cuota & { pagos: Pago | null })[]>([])

  const cargar = useCallback(async () => {
    const [s, f, c, q] = await Promise.all([
      cargarSemanas({ alumnoId: alumno.id, desde: lunes, hasta: lunes }),
      supabase.from('evaluaciones').select('*, sesiones_planificadas(fecha, resumen, tipo)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('competencias').select('*').eq('alumno_id', alumno.id).eq('estado', 'aprobada').gte('fecha', hoy).order('fecha').limit(1).maybeSingle(),
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
    // .then() hace que la consulta se envíe de verdad.
    if (feedback && !feedback.leida_at) supabase.rpc('marcar_evaluacion_leida', { p_evaluacion_id: feedback.id }).then(() => {})
  }, [feedback])

  const fecha = fechaLarga(hoy)
  const deHoy = semana?.sesiones.filter((s) => s.fecha === hoy) ?? []

  return (
    <Pantalla
      titulo={`Hola, ${alumno.nombre.split(' ')[0]}`}
      subtitulo={fecha.charAt(0).toUpperCase() + fecha.slice(1)}
      derecha={
        <div className="flex items-start gap-2">
          {/* Mi perfil: foto con el estado arriba (como las notas de Instagram) */}
          <Link to="/perfil" aria-label="Mi perfil" className="relative flex flex-col items-center pt-7">
            {perfil && estadoVigente(perfil) ? (
              <GloboEstado estado={estadoVigente(perfil)} className="absolute right-0 top-0 max-w-[8.5rem] whitespace-nowrap" />
            ) : (
              <span className="absolute right-0 top-1 whitespace-nowrap rounded-full border border-dashed border-borde bg-superficie px-2 text-[0.65rem] text-texto-2">
                + estado
              </span>
            )}
            <Avatar url={perfil?.avatar_url} nombre={alumno.nombre} tam={48} className="ring-2 ring-azul" />
          </Link>
        </div>
      }
    >
      <InvitarNotificaciones />
      <BienestarHoy alumnoId={alumno.id} />
      <AnunciosAlumno />
      <AvisoZapatillas alumnoId={alumno.id} />
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
                    <ObjetivosSesion s={s} grande />
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

      {!competencia && (
        <Link to="/carreras" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-dashed border-azul bg-superficie px-4 py-3 text-azul">
          <span>
            <span className="block font-semibold">🏁 ¿Tenés una carrera en mente?</span>
            <span className="text-sm text-texto-2">Proponésela a tu entrenador</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      )}

      {competencia && (
        <Link to={`/carrera/${competencia.id}`} className="flex items-center justify-between gap-2 rounded-2xl border border-borde bg-superficie p-4 hover:border-azul">
          <div>
            <p className="text-xs text-texto-2">Próxima competencia</p>
            <p className="font-semibold">{competencia.nombre}</p>
            <p className="text-sm text-texto-2">{formatoFecha(competencia.fecha)}</p>
            <p className="mt-1 text-sm font-semibold text-azul">🏁 Modo carrera: ritmos y clima ›</p>
          </div>
          <p className="text-right">
            <span className="font-titulo text-3xl font-extrabold text-azul">{diasEntre(hoy, competencia.fecha)}</span>
            <span className="block text-xs text-texto-2">días</span>
          </p>
        </Link>
      )}

      {alumno.sexo === 'F' && <MiCiclo />}

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
        <div className="rounded-b-2xl bg-superficie px-4 py-3 text-sm text-tinta">
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
