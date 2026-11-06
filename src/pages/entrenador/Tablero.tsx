import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { cargarSemanas } from '../../lib/consultas'
import { alertasAlumno, estadoDeuda } from '../../lib/calculos'
import { cargarCiclosCompartidos, faseCompartida, type CicloCompartido } from '../../lib/ciclo'
import { kmCorridos } from '../../lib/extras'
import { fechaLarga, hoyPY, lunesDe, rangoSemana } from '../../lib/fechas'
import { formatoKm } from '../../lib/formato'
import type { Alumno, Cuota, SemanaCompleta } from '../../lib/tipos'
import type { Perfil } from '../../lib/sesion'
import { Pantalla } from '../../components/Pantalla'
import { ChipFase } from '../../components/ciclo/CicloEntrenador'
import { Avatar, Cargando, Indicador, MensajeError, Pestanas, Tarjeta, Titulo } from '../../components/ui'

type EstadoHoy = 'hecho' | 'pendiente' | 'descanso' | 'sin_plan'
const ESTADO: Record<EstadoHoy, { texto: string; borde: string; chip: string }> = {
  hecho: { texto: '✓ Entrenó hoy', borde: 'var(--color-ok)', chip: 'bg-ok text-white' },
  pendiente: { texto: '⏳ Falta cargar', borde: 'var(--color-azul)', chip: 'bg-azul/15 text-azul' },
  descanso: { texto: '😌 Descanso', borde: 'transparent', chip: 'bg-borde text-texto-2' },
  sin_plan: { texto: '⚠ Sin plan', borde: 'var(--color-mal)', chip: 'bg-mal/15 text-mal' },
}

/** Todo el grupo en una pantalla: quién entrenó hoy, quién falta, alertas, ciclo, cuota y la carga de la semana. */
export default function Tablero() {
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const [alumnos, setAlumnos] = useState<Alumno[] | null>(null)
  const [semanas, setSemanas] = useState<SemanaCompleta[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({})
  const [ciclos, setCiclos] = useState<Map<string, CicloCompartido>>(new Map())
  const [error, setError] = useState('')
  const [vista, setVista] = useState<'hoy' | 'carga'>('hoy')

  useEffect(() => {
    ;(async () => {
      try {
        const [a, s, c, pr] = await Promise.all([
          supabase.from('alumnos').select('*').eq('activo', true).order('nombre'),
          cargarSemanas({ desde: lunes, hasta: lunes }),
          supabase.from('cuotas').select('*').eq('estado', 'pendiente').lt('vencimiento', hoy),
          supabase.from('profiles').select('*').eq('rol', 'alumno'),
        ])
        if (a.error) throw a.error
        const lista = a.data as Alumno[]
        setAlumnos(lista)
        setSemanas(s)
        setCuotas((c.data ?? []) as Cuota[])
        setPerfiles(Object.fromEntries(((pr.data ?? []) as Perfil[]).map((p) => [p.id, p])))
        const comparten = lista.filter((x) => x.sexo === 'F' && x.comparte_ciclo).map((x) => x.id)
        cargarCiclosCompartidos(comparten)
          .then(setCiclos)
          .catch(() => {})
      } catch {
        setError('No se pudo cargar el tablero.')
      }
    })()
  }, [lunes, hoy])

  const filas = useMemo(
    () =>
      (alumnos ?? []).map((a) => {
        const sem = semanas.find((s) => s.alumno_id === a.id)
        const ses = sem?.sesiones ?? []
        const activas = ses.filter((s) => s.tipo !== 'descanso')
        const deHoy = activas.filter((s) => s.fecha === hoy)
        const estado: EstadoHoy = !sem ? 'sin_plan' : !deHoy.length ? 'descanso' : deHoy.every((s) => s.registro) ? 'hecho' : 'pendiente'
        const porEvaluar = ses.filter((s) => s.registro && !s.evaluacion).length
        const alertas = alertasAlumno(sem ? [sem] : [], hoy)
        const deuda = estadoDeuda(cuotas.filter((c) => c.alumno_id === a.id), hoy)
        const kmPlan = activas.reduce((t, s) => t + Number(s.distancia_km ?? 0), 0)
        const kmHecho = activas.reduce((t, s) => t + (s.registro ? kmCorridos(s.registro) : 0), 0)
        // Lo que debería llevar hasta hoy, para comparar justo a mitad de semana.
        const kmHastaHoy = activas.filter((s) => s.fecha <= hoy).reduce((t, s) => t + Number(s.distancia_km ?? 0), 0)
        const c = ciclos.get(a.id)
        const fase = c ? faseCompartida(c.registros, c.info, hoy) : null
        return { a, estado, porEvaluar, alertas, deuda, kmPlan, kmHecho, kmHastaHoy, fase }
      }),
    [alumnos, semanas, cuotas, ciclos, hoy],
  )

  const cuenta = (e: EstadoHoy) => filas.filter((f) => f.estado === e).length
  const conSesionHoy = cuenta('hecho') + cuenta('pendiente')
  // Primero los que faltan, después los que entrenaron, al final descanso.
  const ordenEstado: Record<EstadoHoy, number> = { sin_plan: 0, pendiente: 1, hecho: 2, descanso: 3 }
  const ordenadas = [...filas].sort((x, y) => ordenEstado[x.estado] - ordenEstado[y.estado] || x.a.nombre.localeCompare(y.a.nombre))
  const fecha = fechaLarga(hoy)

  return (
    <Pantalla titulo="Tablero del grupo" subtitulo={fecha.charAt(0).toUpperCase() + fecha.slice(1)} volver="/alumnos">
      <MensajeError>{error}</MensajeError>
      {!alumnos && !error && <Cargando />}
      {alumnos && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Indicador valor={`${cuenta('hecho')}/${conSesionHoy}`} texto="entrenaron hoy" tono="ok" />
            <Indicador valor={filas.reduce((t, f) => t + f.porEvaluar, 0)} texto="sesiones sin evaluar" tono="azul" />
            <Indicador valor={filas.filter((f) => f.alertas.length || f.estado === 'sin_plan').length} texto="con alertas" tono="mal" />
            <Indicador valor={filas.filter((f) => f.deuda.vencidas.length).length} texto="con cuota vencida" tono="mal" />
          </div>

          <Pestanas
            valor={vista}
            onChange={setVista}
            opciones={[
              { valor: 'hoy', texto: '👥 Hoy' },
              { valor: 'carga', texto: '📊 Carga de la semana' },
            ]}
          />

          {vista === 'hoy' && (
            <ul className="grid grid-cols-2 gap-2">
              {ordenadas.map((f) => {
                const e = ESTADO[f.estado]
                return (
                  <li key={f.a.id}>
                    <Link
                      to={`/alumnos/${f.a.id}`}
                      className="flex h-full flex-col gap-1.5 rounded-3xl border-2 bg-superficie p-3"
                      style={{ borderColor: e.borde === 'transparent' ? 'var(--color-borde)' : e.borde }}
                    >
                      <span className="flex items-center gap-2">
                        <Avatar url={f.a.profile_id ? perfiles[f.a.profile_id]?.avatar_url : null} nombre={f.a.nombre} tam={36} />
                        <span className="min-w-0 truncate font-semibold leading-tight">{f.a.nombre.split(' ').slice(0, 2).join(' ')}</span>
                      </span>
                      <span className={`self-start rounded-full px-2 py-0.5 text-xs font-bold ${e.chip}`}>{e.texto}</span>
                      <span className="flex flex-wrap gap-1">
                        {f.porEvaluar > 0 && <span className="rounded-full border border-azul px-1.5 text-[0.7rem] font-bold text-azul">📝 {f.porEvaluar}</span>}
                        {f.alertas.length > 0 && (
                          <span className="rounded-full bg-mal/15 px-1.5 text-[0.7rem] font-bold text-mal" title={f.alertas.join(' · ')}>
                            ⚠ {f.alertas.length}
                          </span>
                        )}
                        {f.deuda.vencidas.length > 0 && <span className="rounded-full bg-mal px-1.5 text-[0.7rem] font-bold text-white">💸 cuota</span>}
                        {f.fase && <ChipFase e={f.fase} corto />}
                      </span>
                      {f.kmPlan > 0 && (
                        <span className="mt-auto block">
                          <span className="flex justify-between font-mono text-[0.7rem] text-texto-2">
                            <span>{formatoKm(f.kmHecho)} km</span>
                            <span>{formatoKm(f.kmPlan)}</span>
                          </span>
                          <span className="block h-1.5 overflow-hidden rounded-full bg-borde">
                            <span className="block h-full rounded-full bg-ok" style={{ width: `${Math.min(100, (100 * f.kmHecho) / f.kmPlan)}%` }} />
                          </span>
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          {vista === 'carga' && <CargaSemana filas={filas} lunes={lunes} />}
        </>
      )}
    </Pantalla>
  )
}

/** Km de cada alumno en la semana contra lo planificado: quién se pasó y quién quedó corto. */
function CargaSemana({ filas, lunes }: { filas: { a: Alumno; kmPlan: number; kmHecho: number; kmHastaHoy: number }[]; lunes: string }) {
  const con = filas.filter((f) => f.kmPlan > 0)
  const max = Math.max(1, ...con.map((f) => Math.max(f.kmPlan, f.kmHecho)))
  const estado = (f: (typeof con)[number]) => {
    const ref = f.kmHastaHoy || f.kmPlan
    const pct = ref ? f.kmHecho / ref : 0
    return pct > 1.15 ? { t: 'Se pasó', c: '#FF6B6B' } : pct >= 0.8 ? { t: 'Bien', c: 'var(--color-ok)' } : { t: 'Corto', c: '#F2B544' }
  }
  const ordenadas = [...con].sort((x, y) => y.kmHecho / (y.kmHastaHoy || y.kmPlan) - x.kmHecho / (x.kmHastaHoy || x.kmPlan))
  const total = con.reduce((t, f) => t + f.kmHecho, 0)
  const totalPlan = con.reduce((t, f) => t + f.kmPlan, 0)
  return (
    <Tarjeta>
      <Titulo>📊 Carga de la semana</Titulo>
      <p className="-mt-1 mb-3 text-sm text-texto-2">
        Semana {rangoSemana(lunes)} · el grupo lleva <b className="font-mono text-tinta">{formatoKm(total)}</b> de {formatoKm(totalPlan)} km. Se compara con lo planificado hasta hoy.
      </p>
      {con.length === 0 && <p className="text-sm text-texto-2">Todavía no hay planes con km esta semana.</p>}
      <ul className="flex flex-col gap-2.5">
        {ordenadas.map((f) => {
          const e = estado(f)
          return (
            <li key={f.a.id}>
              <Link to={`/alumnos/${f.a.id}`} className="block">
                <span className="mb-0.5 flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold">{f.a.nombre.split(' ').slice(0, 2).join(' ')}</span>
                  <span className="shrink-0 font-mono text-xs">
                    {formatoKm(f.kmHecho)}/{formatoKm(f.kmPlan)} km{' '}
                    <span className="rounded-full px-1.5 font-sans font-bold" style={{ color: e.c, background: `color-mix(in oklab, ${e.c} 15%, transparent)` }}>
                      {e.t}
                    </span>
                  </span>
                </span>
                <span className="relative block h-3 overflow-hidden rounded-full bg-borde">
                  {/* Lo planificado (franja suave) y lo hecho encima. */}
                  <span className="absolute inset-y-0 left-0 rounded-full bg-texto-2/25" style={{ width: `${(100 * f.kmPlan) / max}%` }} />
                  <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700" style={{ width: `${(100 * f.kmHecho) / max}%`, background: e.c }} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-xs text-texto-2">Franja gris: lo planificado de la semana. Color: lo que lleva hecho (verde bien, amarillo corto, rojo se pasó).</p>
    </Tarjeta>
  )
}
