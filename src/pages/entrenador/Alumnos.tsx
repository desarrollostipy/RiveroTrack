import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { cargarSemanas } from '../../lib/consultas'
import { alertasAlumno, estadoDeuda } from '../../lib/calculos'
import { hoyPY, lunesDe, rangoSemana, sumarDias } from '../../lib/fechas'
import type { Alumno, Cuota, SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { CuadritosSemana, LeyendaCuadritos } from '../../components/Semana'
import { DatosPrueba } from './DatosPrueba'
import { Avatar, Cargando, estadoVigente, GloboEstado, Indicador, MensajeError, Opciones, Selector, Tarjeta, Vacio } from '../../components/ui'
import { useNoLeidos } from '../../lib/chat'
import { useGrupos } from '../../lib/grupos'
import { EtiquetaGrupo } from './Grupos'
import type { Perfil } from '../../lib/sesion'
import { cargarAlertas } from '../../lib/alertas'

type Filtro = 'todos' | 'por_evaluar' | 'alertas'

export default function Alumnos() {
  const { perfil } = useSesion()
  const { porAlumno: noLeidos } = useNoLeidos(perfil?.id)
  const { grupos, grupo } = useGrupos()
  const [grupoFiltro, setGrupoFiltro] = useState('')
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({})
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const [alumnos, setAlumnos] = useState<Alumno[] | null>(null)
  const [semanas, setSemanas] = useState<SemanaCompleta[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [solicitudes, setSolicitudes] = useState(0)
  const [carrerasPendientes, setCarrerasPendientes] = useState(0)
  const [avisos, setAvisos] = useState<{ rojas: number; total: number } | null>(null)
  const [comprobantes, setComprobantes] = useState(0)

  useEffect(() => {
    cargarAlertas().then(({ alertas }) => setAvisos({ rojas: alertas.filter((a) => a.nivel === 'rojo').length, total: alertas.length }))
    supabase.from('comprobantes_pago').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente').then(({ count }) => setComprobantes(count ?? 0))
  }, [])

  const cargar = useCallback(async () => {
    try {
      const [a, s, c, sol, comp, pr] = await Promise.all([
        supabase.from('alumnos').select('*').eq('activo', true).order('nombre'),
        cargarSemanas({ desde: sumarDias(lunes, -14), hasta: lunes }),
        supabase.from('cuotas').select('*').eq('estado', 'pendiente').lt('vencimiento', hoy),
        supabase.from('solicitudes_alta').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('competencias').select('id', { count: 'exact', head: true }).eq('estado', 'propuesta').gte('fecha', hoy),
        supabase.from('profiles').select('*').eq('rol', 'alumno'),
      ])
      if (a.error) throw a.error
      setAlumnos(a.data as Alumno[])
      setSemanas(s)
      setCuotas((c.data ?? []) as Cuota[])
      setSolicitudes(sol.count ?? 0)
      setCarrerasPendientes(comp.count ?? 0)
      setPerfiles(Object.fromEntries(((pr.data ?? []) as Perfil[]).map((p) => [p.id, p])))
    } catch {
      setError('No se pudo cargar la lista de alumnos.')
    }
  }, [lunes, hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Realtime: cuando un alumno registra una sesión, se actualiza sola.
  useEffect(() => {
    const canal = supabase
      .channel('panel-alumnos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones_registradas' }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargar])

  const filas = useMemo(
    () =>
      (alumnos ?? []).map((a) => {
        const propias = semanas.filter((s) => s.alumno_id === a.id)
        const actual = propias.find((s) => s.semana_inicio === lunes)
        const sesiones = actual?.sesiones ?? []
        const activas = sesiones.filter((s) => s.tipo !== 'descanso')
        const porEvaluar = propias.flatMap((p) => p.sesiones).filter((s) => s.registro && !s.evaluacion).length
        const alertas = alertasAlumno(propias, hoy)
        if (!actual) alertas.unshift('Sin plan para esta semana')
        else if (actual.estado === 'borrador') alertas.unshift('Plan de esta semana en borrador (no lo ve)')
        const deuda = estadoDeuda(cuotas.filter((c) => c.alumno_id === a.id), hoy)
        return { a, actual, sesiones, hechas: activas.filter((s) => s.registro).length, plan: activas.length, porEvaluar, alertas, deuda }
      }),
    [alumnos, semanas, cuotas, lunes, hoy],
  )

  const conAlertas = filas.filter((f) => f.alertas.length)
  const conPorEvaluar = filas.filter((f) => f.porEvaluar)
  const alDia = filas.filter((f) => !f.alertas.length && !f.porEvaluar)
  const visibles = (filtro === 'alertas' ? conAlertas : filtro === 'por_evaluar' ? conPorEvaluar : filas).filter((f) => !grupoFiltro || f.a.grupo_id === grupoFiltro)

  return (
    <Pantalla
      titulo="Alumnos"
      subtitulo={`Semana ${rangoSemana(lunes)}`}
      derecha={
        <div className="flex gap-2">
          <Link
            to="/herramientas"
            aria-label="Herramientas"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-borde bg-superficie text-xl"
          >
            ☰
          </Link>
          <Link
            to="/alumnos/nuevo"
            aria-label="Dar de alta un alumno"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-azul text-2xl font-bold text-white hover:bg-azul-hover"
          >
            +
          </Link>
          <Link to="/perfil" aria-label="Mi perfil" className="flex min-h-11 items-center">
            <Avatar url={perfil?.avatar_url} nombre={perfil?.nombre ?? 'Yo'} tam={44} className="ring-2 ring-azul" />
          </Link>
        </div>
      }
    >
      <MensajeError>{error}</MensajeError>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/agenda" className="flex min-h-14 items-center gap-2 rounded-2xl border border-borde bg-superficie px-3 font-semibold hover:border-azul">
          <span className="text-2xl" aria-hidden="true">
            📆
          </span>
          Agenda de hoy
        </Link>
        <Link
          to="/alertas"
          className={`flex min-h-14 items-center gap-2 rounded-2xl px-3 font-semibold ${avisos?.rojas ? 'bg-mal text-white' : 'border border-borde bg-superficie hover:border-azul'}`}
        >
          <span className="text-2xl" aria-hidden="true">
            🔔
          </span>
          <span>
            Alertas
            {avisos && avisos.total > 0 && <span className="block text-xs font-normal opacity-90">{avisos.rojas ? `${avisos.rojas} para atender hoy` : `${avisos.total} para mirar`}</span>}
          </span>
        </Link>
      </div>
      {comprobantes > 0 && (
        <Link to="/finanzas" className="flex min-h-14 items-center justify-between gap-2 rounded-2xl bg-ok px-4 py-3 font-semibold text-white">
          <span>
            🧾 {comprobantes} {comprobantes === 1 ? 'pago para revisar' : 'pagos para revisar'}
          </span>
          <span className="rounded-xl bg-white/20 px-3 py-1 text-sm">Revisar</span>
        </Link>
      )}
      {solicitudes > 0 && (
        <Link
          to="/solicitudes"
          className="flex min-h-14 items-center justify-between gap-2 rounded-2xl bg-azul px-4 py-3 font-semibold text-white hover:bg-azul-hover"
        >
          <span>
            📝 {solicitudes} {solicitudes === 1 ? 'alumno nuevo se registró' : 'alumnos nuevos se registraron'}
          </span>
          <span className="rounded-xl bg-white/20 px-3 py-1 text-sm">Revisar</span>
        </Link>
      )}
      {carrerasPendientes > 0 && (
        <Link
          to="/competencias"
          className="flex min-h-14 items-center justify-between gap-2 rounded-2xl bg-parcial px-4 py-3 font-semibold text-[#0B1B3A] hover:brightness-95"
        >
          <span>
            🏁 {carrerasPendientes} {carrerasPendientes === 1 ? 'competencia para aprobar' : 'competencias para aprobar'}
          </span>
          <span className="rounded-xl bg-white/50 px-3 py-1 text-sm">Revisar</span>
        </Link>
      )}
      {alumnos === null && !error && <Cargando />}
      {alumnos && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Indicador valor={alDia.length} texto="al día" tono="ok" />
            <Indicador valor={conPorEvaluar.length} texto="sin evaluar" tono="azul" />
            <Indicador valor={conAlertas.length} texto="con alertas" tono="mal" />
          </div>

          <Opciones
            label="Mostrar"
            valor={filtro}
            onChange={setFiltro}
            opciones={[
              { valor: 'todos', texto: `Todos (${filas.length})` },
              { valor: 'por_evaluar', texto: `Por evaluar (${conPorEvaluar.length})` },
              { valor: 'alertas', texto: `Alertas (${conAlertas.length})` },
            ]}
          />
          {grupos.length > 0 && (
            <Selector id="filtro-grupo" label="Grupo" value={grupoFiltro} onChange={(e) => setGrupoFiltro(e.target.value)}>
              <option value="">Todos los grupos</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nombre}
                </option>
              ))}
            </Selector>
          )}

          {alumnos.length === 0 && (
            <Vacio>
              Todavía no hay alumnos. Tocá <strong>+</strong> para dar de alta el primero.
            </Vacio>
          )}

          <ul className="flex flex-col gap-2">
            {visibles.map((f) => (
              <li key={f.a.id}>
                <Link to={`/alumnos/${f.a.id}`} className="block rounded-2xl">
                  <Tarjeta className="flex flex-col gap-2 hover:border-azul">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar url={f.a.profile_id ? perfiles[f.a.profile_id]?.avatar_url : null} nombre={f.a.nombre} tam={44} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                            {f.a.nombre} <EtiquetaGrupo grupo={grupo(f.a.grupo_id)} />
                          </p>
                          <p className="truncate text-sm text-texto-2">{f.a.objetivo || 'Sin objetivo cargado'}</p>
                        </div>
                      </div>
                      <p className="shrink-0 font-mono text-sm font-semibold" aria-label={`${f.hechas} de ${f.plan} sesiones hechas`}>
                        {f.hechas}/{f.plan}
                      </p>
                    </div>
                    <CuadritosSemana sesiones={f.sesiones} lunes={lunes} hoy={hoy} hayPlan={!!f.actual} />
                    {f.a.profile_id && perfiles[f.a.profile_id] && estadoVigente(perfiles[f.a.profile_id]) && (
                      <GloboEstado estado={estadoVigente(perfiles[f.a.profile_id])} className="self-start" />
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(noLeidos[f.a.id] ?? 0) > 0 && (
                        <span className="rounded-full bg-azul px-2 py-0.5 text-xs font-bold text-white">💬 {noLeidos[f.a.id]} sin leer</span>
                      )}
                      {f.deuda.vencidas.length > 0 && (
                        <span className="rounded-full bg-mal px-2 py-0.5 text-xs font-bold text-white">Cuota vencida</span>
                      )}
                      {f.porEvaluar > 0 && (
                        <span className="rounded-full border border-azul px-2 py-0.5 text-xs font-bold text-azul">{f.porEvaluar} por evaluar</span>
                      )}
                    </div>
                    {f.alertas.length > 0 && (
                      <ul className="text-sm text-mal">
                        {f.alertas.map((t) => (
                          <li key={t}>⚠ {t}</li>
                        ))}
                      </ul>
                    )}
                  </Tarjeta>
                </Link>
              </li>
            ))}
          </ul>

          {alumnos.length > 0 && <LeyendaCuadritos />}
          <Link to="/competencias" className="flex min-h-11 items-center justify-center rounded-xl border border-borde bg-superficie font-semibold text-azul">🏁 Ver todas las competencias</Link>
          <DatosPrueba hayAlumnos={alumnos.length > 0} onCambio={cargar} />
        </>
      )}
    </Pantalla>
  )
}
