import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { kmPlanificados } from '../../lib/calculos'
import { diaSemana, hoyPY, lunesDe, rangoSemana, sumarDias } from '../../lib/fechas'
import { formatoKm } from '../../lib/formato'
import type { Alumno, Plan, SesionPlan } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { Cargando, Indicador, Opciones, SelectorPeriodo, Vacio } from '../../components/ui'

type PlanResumen = Plan & { sesiones_planificadas: SesionPlan[] }
type Filtro = 'todos' | 'sin_plan' | 'borrador' | 'publicado'

// Vista para armar los planes de todos: el domingo se planifica la semana siguiente.
export default function Planes() {
  const hoy = hoyPY()
  const [params, setParams] = useSearchParams()
  const porDefecto = diaSemana(hoy) >= 4 ? sumarDias(lunesDe(hoy), 7) : lunesDe(hoy) // de viernes en adelante, la próxima
  const lunes = lunesDe(params.get('semana') || porDefecto)
  const [alumnos, setAlumnos] = useState<Pick<Alumno, 'id' | 'nombre' | 'nivel'>[] | null>(null)
  const [planes, setPlanes] = useState<PlanResumen[]>([])
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    setAlumnos(null)
    Promise.all([
      supabase.from('alumnos').select('id, nombre, nivel').eq('activo', true).order('nombre'),
      supabase.from('planes_semanales').select('*, sesiones_planificadas(*)').eq('semana_inicio', lunes),
    ]).then(([a, p]) => {
      setAlumnos((a.data ?? []) as Alumno[])
      setPlanes((p.data ?? []) as PlanResumen[])
    })
  }, [lunes])

  const filas = (alumnos ?? []).map((a) => {
    const plan = planes.find((p) => p.alumno_id === a.id)
    const estado: Exclude<Filtro, 'todos'> = !plan ? 'sin_plan' : plan.estado
    const km = plan?.sesiones_planificadas.reduce((t, s) => t + kmPlanificados(s).km, 0) ?? 0
    const sesiones = plan?.sesiones_planificadas.filter((s) => s.tipo !== 'descanso').length ?? 0
    return { a, plan, estado, km, sesiones }
  })
  const cuenta = (e: Filtro) => filas.filter((f) => f.estado === e).length
  const visibles = filtro === 'todos' ? filas : filas.filter((f) => f.estado === filtro)

  return (
    <Pantalla titulo="Planes" subtitulo="Armá y publicá el plan de cada alumno">
      <SelectorPeriodo
        texto={rangoSemana(lunes)}
        detalle={lunes === lunesDe(hoy) ? 'Semana actual' : lunes > lunesDe(hoy) ? 'Próxima' : 'Anterior'}
        onAnterior={() => setParams({ semana: sumarDias(lunes, -7) }, { replace: true })}
        onSiguiente={() => setParams({ semana: sumarDias(lunes, 7) }, { replace: true })}
      />
      {alumnos === null ? (
        <Cargando />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Indicador valor={cuenta('publicado')} texto="publicados" tono="ok" />
            <Indicador valor={cuenta('borrador')} texto="en borrador" tono="azul" />
            <Indicador valor={cuenta('sin_plan')} texto="sin plan" tono="mal" />
          </div>
          <Opciones
            label="Mostrar"
            valor={filtro}
            onChange={setFiltro}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              { valor: 'sin_plan', texto: 'Sin plan' },
              { valor: 'borrador', texto: 'Borrador' },
              { valor: 'publicado', texto: 'Publicados' },
            ]}
          />
          {alumnos.length === 0 && <Vacio>Primero da de alta a tus alumnos en la pestaña Alumnos.</Vacio>}
          <ul className="flex flex-col gap-2">
            {visibles.map((f) => (
              <li key={f.a.id}>
                <Link
                  to={`/alumnos/${f.a.id}/plan?semana=${lunes}`}
                  className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-borde bg-superficie px-4 py-3 hover:border-azul"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{f.a.nombre}</span>
                    <span className="text-sm text-texto-2">
                      {f.plan ? `${f.sesiones} sesiones · ${formatoKm(f.km)} km` : 'Tocá para armar el plan'}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      f.estado === 'publicado' ? 'bg-ok text-white' : f.estado === 'borrador' ? 'bg-parcial text-[#0B1B3A]' : 'bg-mal/15 text-mal'
                    }`}
                  >
                    {f.estado === 'publicado' ? 'Publicado' : f.estado === 'borrador' ? 'Borrador' : 'Sin plan'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Pantalla>
  )
}
