import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../lib/supabase'
import { cargarSemanas } from '../lib/consultas'
import { alertasAlumno } from '../lib/calculos'
import { formatoFecha, formatoKm, formatoRitmo } from '../lib/formato'
import { hoyPY, lunesDe, sumarDias } from '../lib/fechas'
import { Cargando, Indicador, Tarjeta, Titulo, Vacio } from './ui'

export type FilaResumen = {
  semana_inicio: string
  km_plan: number
  km_real: number
  sesiones_plan: number
  sesiones_hechas: number
  cumplimiento_pct: number | null
  ritmo_prom_seg: number | null
  evaluaciones_ok: number
}

export type PuntoFondo = { fecha: string; ritmo: number }

const SEMANAS = 8

/** Últimas 8 semanas del alumno (el alumno solo ve sus semanas publicadas). */
export async function cargarEvolucion(alumnoId: string) {
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const desde = sumarDias(lunes, -7 * (SEMANAS - 1))
  const [r, f] = await Promise.all([
    supabase.from('v_resumen_semanal').select('*').eq('alumno_id', alumnoId).gte('semana_inicio', desde).lte('semana_inicio', lunes).order('semana_inicio'),
    supabase
      .from('sesiones_registradas')
      .select('fecha, ritmo_prom_seg, sesiones_planificadas!inner(tipo)')
      .eq('alumno_id', alumnoId)
      .eq('sesiones_planificadas.tipo', 'fondo')
      .gte('fecha', sumarDias(desde, -56))
      .order('fecha'),
  ])
  const semanas = ((r.data ?? []) as FilaResumen[]).map((s) => ({
    ...s,
    km_plan: Number(s.km_plan),
    km_real: Number(s.km_real),
    ritmo_prom_seg: s.ritmo_prom_seg === null ? null : Number(s.ritmo_prom_seg),
  }))
  const fondos = ((f.data ?? []) as { fecha: string; ritmo_prom_seg: number | null }[])
    .filter((x) => x.ritmo_prom_seg)
    .map((x) => ({ fecha: x.fecha, ritmo: x.ritmo_prom_seg! }))
  return { semanas, fondos, lunes }
}

export function indicadores(semanas: FilaResumen[], fondos: PuntoFondo[], lunes: string) {
  const cerradas = semanas.filter((s) => s.semana_inicio < lunes)
  const kmPlan = cerradas.reduce((t, s) => t + s.km_plan, 0)
  const kmReal = cerradas.reduce((t, s) => t + s.km_real, 0)
  const pct = kmPlan ? Math.round((100 * kmReal) / kmPlan) : null
  const promedio = cerradas.length ? kmReal / cerradas.length : 0
  const recientes = fondos.slice(-3)
  const previos = fondos.slice(-6, -3)
  const media = (xs: PuntoFondo[]) => (xs.length ? xs.reduce((t, x) => t + x.ritmo, 0) / xs.length : null)
  const actual = media(recientes)
  const anterior = media(previos)
  const variacion = actual && anterior ? Math.round(actual - anterior) : null
  const kmTotal = semanas.reduce((t, s) => t + s.km_real, 0)
  // Ritmo promedio de todas las sesiones, ponderado por km.
  const conRitmo = semanas.filter((s) => s.ritmo_prom_seg && s.km_real > 0)
  const kmConRitmo = conRitmo.reduce((t, s) => t + s.km_real, 0)
  const ritmoGeneral = kmConRitmo ? conRitmo.reduce((t, s) => t + s.ritmo_prom_seg! * s.km_real, 0) / kmConRitmo : null
  return { pct, promedio, actual, anterior, variacion, kmTotal, ritmoGeneral }
}

export function GraficoKm({ semanas, lunes }: { semanas: FilaResumen[]; lunes: string }) {
  const datos = semanas.map((s) => ({ semana: formatoFecha(s.semana_inicio), Planificado: Math.round(s.km_plan), Hecho: Math.round(s.km_real), actual: s.semana_inicio === lunes }))
  return (
    <div className="h-56" role="img" aria-label="Km planificados contra hechos por semana">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={datos} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-borde)" />
          <XAxis dataKey="semana" tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
          <Tooltip formatter={(v) => `${v} km`} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Planificado" fill="var(--color-borde)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Hecho" radius={[4, 4, 0, 0]} fill="var(--color-azul)">
            {datos.map((d) => (
              <Cell key={d.semana} fill="var(--color-azul)" fillOpacity={d.actual ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function GraficoFondos({ fondos }: { fondos: PuntoFondo[] }) {
  if (fondos.length < 2) return <p className="text-sm text-texto-2">Todavía no hay suficientes fondos registrados.</p>
  const datos = fondos.map((f) => ({ fecha: formatoFecha(f.fecha), ritmo: f.ritmo }))
  return (
    <div className="h-48" role="img" aria-label="Ritmo promedio en fondos">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-borde)" />
          <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
          <YAxis
            reversed
            domain={['dataMin - 10', 'dataMax + 10']}
            tickFormatter={(v) => formatoRitmo(v)}
            tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip formatter={(v) => `${formatoRitmo(Number(v))}/km`} />
          <Line type="monotone" dataKey="ritmo" name="Ritmo" stroke="#0F6E78" strokeWidth={2.5} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Evolución de un alumno (vista del entrenador). */
export function EvolucionAlumno({ alumnoId }: { alumnoId: string }) {
  const [datos, setDatos] = useState<Awaited<ReturnType<typeof cargarEvolucion>> | null>(null)
  const [alertas, setAlertas] = useState<string[]>([])

  useEffect(() => {
    setDatos(null)
    const hoy = hoyPY()
    cargarEvolucion(alumnoId).then(setDatos)
    cargarSemanas({ alumnoId, desde: sumarDias(lunesDe(hoy), -14), hasta: lunesDe(hoy) }).then((s) => setAlertas(alertasAlumno(s, hoy)))
  }, [alumnoId])

  if (!datos) return <Cargando />
  if (!datos.semanas.length) return <Vacio>Todavía no hay semanas planificadas para mostrar.</Vacio>
  const ind = indicadores(datos.semanas, datos.fondos, datos.lunes)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Indicador valor={ind.pct !== null ? `${ind.pct}%` : '—'} texto="km hechos vs plan" tono={ind.pct !== null && ind.pct < 70 ? 'mal' : 'ok'} />
        <Indicador valor={formatoKm(ind.promedio)} texto="km por semana" />
        <Indicador
          valor={ind.variacion !== null ? `${ind.variacion > 0 ? '+' : ind.variacion < 0 ? '−' : ''}${Math.abs(ind.variacion)}″` : '—'}
          texto="ritmo en fondos"
          tono={ind.variacion !== null && ind.variacion < 0 ? 'ok' : ind.variacion ? 'mal' : 'normal'}
        />
      </div>
      <Tarjeta>
        <Titulo>Km por semana</Titulo>
        <GraficoKm semanas={datos.semanas} lunes={datos.lunes} />
        <p className="text-xs text-texto-2">La semana en curso aparece en tono más claro.</p>
      </Tarjeta>
      <Tarjeta>
        <Titulo>Ritmo en fondos</Titulo>
        <GraficoFondos fondos={datos.fondos} />
        {ind.actual && (
          <p className="text-sm text-texto-2">
            Últimos 3 fondos: <span className="font-mono">{formatoRitmo(ind.actual)}/km</span>
            {ind.anterior ? (
              <>
                {' '}· 3 anteriores: <span className="font-mono">{formatoRitmo(ind.anterior)}/km</span>
              </>
            ) : null}
          </p>
        )}
      </Tarjeta>
      <Tarjeta>
        <Titulo>Para tener en cuenta</Titulo>
        {alertas.length ? (
          <ul className="flex flex-col gap-1 text-sm text-mal">
            {alertas.map((a) => (
              <li key={a}>⚠ {a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ok">Sin alertas.</p>
        )}
      </Tarjeta>
    </div>
  )
}
