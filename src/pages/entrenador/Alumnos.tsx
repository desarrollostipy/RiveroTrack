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
import { Boton, Cargando, Indicador, MensajeError, Opciones, Tarjeta, Vacio } from '../../components/ui'

type Filtro = 'todos' | 'por_evaluar' | 'alertas'

export default function Alumnos() {
  const { salir } = useSesion()
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const [alumnos, setAlumnos] = useState<Alumno[] | null>(null)
  const [semanas, setSemanas] = useState<SemanaCompleta[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [solicitudes, setSolicitudes] = useState(0)
  const [carrerasPendientes, setCarrerasPendientes] = useState(0)

  const cargar = useCallback(async () => {
    try {
      const [a, s, c, sol, comp] = await Promise.all([
        supabase.from('alumnos').select('*').eq('activo', true).order('nombre'),
        cargarSemanas({ desde: sumarDias(lunes, -14), hasta: lunes }),
        supabase.from('cuotas').select('*').eq('estado', 'pendiente').lt('vencimiento', hoy),
        supabase.from('solicitudes_alta').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
        supabase.from('competencias').select('id', { count: 'exact', head: true }).eq('estado', 'propuesta').gte('fecha', hoy),
      ])
      if (a.error) throw a.error
      setAlumnos(a.data as Alumno[])
      setSemanas(s)
      setCuotas((c.data ?? []) as Cuota[])
      setSolicitudes(sol.count ?? 0)
      setCarrerasPendientes(comp.count ?? 0)
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
  const visibles = filtro === 'alertas' ? conAlertas : filtro === 'por_evaluar' ? conPorEvaluar : filas

  return (
    <Pantalla
      titulo="Alumnos"
      subtitulo={`Semana ${rangoSemana(lunes)}`}
      derecha={
        <div className="flex gap-2">
          <Link
            to="/alumnos/nuevo"
            aria-label="Dar de alta un alumno"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-azul text-2xl font-bold text-white hover:bg-azul-hover"
          >
            +
          </Link>
          <Boton variante="borde" onClick={salir}>
            Salir
          </Boton>
        </div>
      }
    >
      <MensajeError>{error}</MensajeError>
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
          className="flex min-h-14 items-center justify-between gap-2 rounded-2xl bg-parcial px-4 py-3 font-semibold text-marino hover:brightness-95"
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
                      <div className="min-w-0">
                        <p className="font-semibold">{f.a.nombre}</p>
                        <p className="truncate text-sm text-texto-2">{f.a.objetivo || 'Sin objetivo cargado'}</p>
                      </div>
                      <p className="shrink-0 font-mono text-sm font-semibold" aria-label={`${f.hechas} de ${f.plan} sesiones hechas`}>
                        {f.hechas}/{f.plan}
                      </p>
                    </div>
                    <CuadritosSemana sesiones={f.sesiones} lunes={lunes} hoy={hoy} hayPlan={!!f.actual} />
                    <div className="flex flex-wrap gap-1.5">
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
          <Link to="/competencias" className="flex min-h-11 items-center justify-center rounded-xl border border-borde bg-white font-semibold text-azul">🏁 Ver todas las competencias</Link>
          <DatosPrueba hayAlumnos={alumnos.length > 0} onCambio={cargar} />
        </>
      )}
    </Pantalla>
  )
}
