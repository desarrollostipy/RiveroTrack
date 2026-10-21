import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { cargarSemanas, mensajeError } from '../../lib/consultas'
import { DIAS, diaSemana, hoyPY, lunesDe, rangoSemana, sumarDias } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm } from '../../lib/formato'
import { armarPlanCarrera, type SemanaNueva } from '../../lib/planCarrera'
import type { Competencia, SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { useTipos } from '../../components/Semana'
import { Boton, Cargando, EtiquetaTipo, MensajeError, MensajeOk, Tarjeta, Vacio } from '../../components/ui'

/** Plan de carrera: arma como borrador las semanas previas a una competencia, bajando la carga. */
export default function PlanCarrera() {
  const { id } = useParams()
  const hoy = hoyPY()
  const { tipos, tipo } = useTipos()
  const [c, setC] = useState<(Competencia & { alumnos: { nombre: string } | null }) | null | undefined>(undefined)
  const [semanas, setSemanas] = useState<SemanaCompleta[] | null>(null)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [creando, setCreando] = useState(false)

  useEffect(() => {
    supabase
      .from('competencias')
      .select('*, alumnos(nombre)')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => {
        const comp = data as (Competencia & { alumnos: { nombre: string } | null }) | null
        setC(comp)
        if (comp) cargarSemanas({ alumnoId: comp.alumno_id, desde: sumarDias(lunesDe(hoy), -56), hasta: lunesDe(comp.fecha) }).then(setSemanas)
      })
  }, [id, hoy])

  if (c === undefined || (c && !semanas) || !tipos.length) return <Cargando pantalla />
  if (!c)
    return (
      <Pantalla titulo="Plan de carrera" volver="/competencias">
        <MensajeError>No se encontró la competencia.</MensajeError>
      </Pantalla>
    )

  const lista = semanas ?? []
  // Base: la última semana publicada con sesiones, antes de las semanas que se van a armar.
  const primera = sumarDias(lunesDe(c.fecha), -14)
  const base = [...lista].reverse().find((s) => s.estado === 'publicado' && s.semana_inicio < primera && s.sesiones.some((x) => x.tipo !== 'descanso'))
  const propuesta: SemanaNueva[] = base ? armarPlanCarrera(c, base, tipos) : []
  const ocupada = (lunes: string) => lista.find((s) => s.semana_inicio === lunes && s.sesiones.length > 0)
  const nombre = c.alumnos?.nombre ?? 'Alumno'

  async function crear() {
    setError('')
    setCreando(true)
    let hechas = 0
    for (const w of propuesta) {
      if (ocupada(w.lunes) || w.lunes < lunesDe(hoy)) continue
      const { data: plan, error: e1 } = await supabase
        .from('planes_semanales')
        .upsert({ alumno_id: c!.alumno_id, semana_inicio: w.lunes, nota_semana: `🏁 ${c!.nombre}: ${w.nota}` }, { onConflict: 'alumno_id,semana_inicio' })
        .select('id')
        .single()
      if (e1 || !plan) {
        setCreando(false)
        return setError(mensajeError(e1))
      }
      const { error: e2 } = await supabase.from('sesiones_planificadas').insert(w.sesiones.map((s) => ({ ...s, plan_id: (plan as { id: string }).id })))
      if (e2) {
        setCreando(false)
        return setError(mensajeError(e2))
      }
      hechas++
    }
    setCreando(false)
    setOk(hechas ? `Listo: ${hechas} semana${hechas === 1 ? '' : 's'} en borrador. Revisalas y publicalas desde el plan de ${nombre.split(' ')[0]}.` : 'No había semanas libres para armar.')
  }

  return (
    <Pantalla titulo="🧭 Plan de carrera" subtitulo={`${nombre} · ${c.nombre} · ${formatoFecha(c.fecha)}`} volver="/competencias">
      {!base ? (
        <Vacio>Para armar el plan hace falta al menos una semana publicada de {nombre.split(' ')[0]} como base (antes del {formatoFecha(primera)}).</Vacio>
      ) : (
        <>
          <Tarjeta>
            <p className="text-sm">
              Toma como base la semana del <b>{rangoSemana(base.semana_inicio)}</b> y baja la carga: <b>80%</b> dos semanas antes, <b>65%</b> la semana anterior y{' '}
              <b>40%</b> la semana de la carrera, con descanso el día previo.
              {c.tiempo_objetivo_seg && c.distancia_km ? ` El día de la carrera incluye la estrategia para ${formatoDuracion(c.tiempo_objetivo_seg)}.` : ''}
            </p>
            <p className="mt-2 text-sm text-texto-2">Se crea como <b>borrador</b>: el alumno no lo ve hasta que lo publiques.</p>
          </Tarjeta>

          {propuesta.map((w) => {
            const yaTiene = ocupada(w.lunes)
            const pasada = w.lunes < lunesDe(hoy)
            const km = w.sesiones.reduce((t, s) => t + (s.distancia_km ?? 0), 0)
            return (
              <Tarjeta key={w.lunes} className={yaTiene || pasada ? 'opacity-60' : ''}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{w.titulo}</p>
                    <p className="text-sm text-texto-2">{rangoSemana(w.lunes)}</p>
                  </div>
                  <span className="rounded-xl bg-azul/10 px-2 py-1 text-sm font-bold text-azul">{Math.round(w.factor * 100)}%</span>
                </div>
                {yaTiene ? (
                  <p className="text-sm font-semibold text-[#9A6B00]">Ya tiene plan cargado: no se toca.</p>
                ) : pasada ? (
                  <p className="text-sm text-texto-2">Esta semana ya pasó.</p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-1.5">
                      {w.sesiones.map((s, i) => {
                        const t = tipo(s.tipo)
                        return (
                          <li key={i} className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="w-20 shrink-0 text-texto-2">
                              {DIAS[diaSemana(s.fecha)].slice(0, 3)} {formatoFecha(s.fecha)}
                            </span>
                            <EtiquetaTipo nombre={t.nombre} color={t.color} />
                            <span className="font-semibold">{s.resumen}</span>
                          </li>
                        )
                      })}
                    </ul>
                    {km > 0 && <p className="mt-2 text-xs text-texto-2">≈ {formatoKm(km)} km en la semana</p>}
                  </>
                )}
              </Tarjeta>
            )
          })}

          <MensajeError>{error}</MensajeError>
          <MensajeOk>{ok}</MensajeOk>
          {ok ? (
            <Link to={`/alumnos/${c.alumno_id}/plan`} className="flex min-h-12 items-center justify-center rounded-xl bg-azul font-semibold text-white">
              Ir al plan de {nombre.split(' ')[0]}
            </Link>
          ) : (
            <Boton onClick={crear} disabled={creando}>
              {creando ? 'Armando…' : 'Crear como borrador'}
            </Boton>
          )}
        </>
      )}
    </Pantalla>
  )
}
