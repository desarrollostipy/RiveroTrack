// Historial completo de un alumno para récords, retos, logros y comparaciones.

import { supabase } from './supabase'
import { hoyPY, lunesDe, primerDiaMes, sumarDias, sumarMeses } from './fechas'
import type { Split } from './tipos'

export type SesionHist = {
  fecha: string
  distancia_km: number | null
  duracion_seg: number | null
  ritmo_prom_seg: number | null
  fc_prom: number | null
  splits: Split[]
  desnivel_m: number | null
  tipo: string | null
  resumen: string | null
}

export type Historial = {
  sesiones: SesionHist[]
  semanas: { semana_inicio: string; km_plan: number; km_real: number; sesiones_plan: number; sesiones_hechas: number; cumplimiento_pct: number | null }[]
  marcas: { distancia: string; tiempo_seg: number; fecha: string | null; carrera: string | null }[]
  carreras: { nombre: string; fecha: string; distancia_km: number | null; resultado_tiempo_seg: number | null; tiempo_objetivo_seg: number | null }[]
  asistencias: { fecha: string }[]
}

const memoria = new Map<string, Historial>()

export async function cargarHistorial(alumnoId: string): Promise<Historial> {
  const [s, v, m, c, a] = await Promise.all([
    supabase
      .from('sesiones_registradas')
      .select('fecha, distancia_km, duracion_seg, ritmo_prom_seg, fc_prom, splits, datos_crudos, sesiones_planificadas(tipo, resumen)')
      .eq('alumno_id', alumnoId)
      .order('fecha'),
    supabase.from('v_resumen_semanal').select('semana_inicio, km_plan, km_real, sesiones_plan, sesiones_hechas, cumplimiento_pct').eq('alumno_id', alumnoId).order('semana_inicio'),
    supabase.from('marcas_personales').select('distancia, tiempo_seg, fecha, carrera').eq('alumno_id', alumnoId),
    supabase.from('competencias').select('nombre, fecha, distancia_km, resultado_tiempo_seg, tiempo_objetivo_seg').eq('alumno_id', alumnoId).eq('estado', 'aprobada'),
    supabase.from('asistencias').select('entrenamientos_grupales(fecha)').eq('alumno_id', alumnoId),
  ])
  const uno = <T,>(x: T | T[] | null | undefined) => (Array.isArray(x) ? x[0] : x) ?? null
  const h: Historial = {
    sesiones: ((s.data ?? []) as Record<string, any>[]).map((x) => {
      const sp = uno(x.sesiones_planificadas) as { tipo: string; resumen: string | null } | null
      return {
        fecha: x.fecha,
        distancia_km: x.distancia_km === null ? null : Number(x.distancia_km),
        duracion_seg: x.duracion_seg,
        ritmo_prom_seg: x.ritmo_prom_seg,
        fc_prom: x.fc_prom,
        splits: Array.isArray(x.splits) ? x.splits : [],
        desnivel_m: x.datos_crudos?.desnivel_m ?? null,
        tipo: sp?.tipo ?? null,
        resumen: sp?.resumen ?? null,
      }
    }),
    semanas: ((v.data ?? []) as Historial['semanas']).map((x) => ({ ...x, km_plan: Number(x.km_plan), km_real: Number(x.km_real) })),
    marcas: (m.data ?? []) as Historial['marcas'],
    carreras: (c.data ?? []) as Historial['carreras'],
    asistencias: ((a.data ?? []) as { entrenamientos_grupales: unknown }[])
      .map((x) => uno(x.entrenamientos_grupales as { fecha: string } | { fecha: string }[]))
      .filter(Boolean) as { fecha: string }[],
  }
  memoria.set(alumnoId, h)
  return h
}
export const historialEnMemoria = (alumnoId: string) => memoria.get(alumnoId)

// ---------- Récords ----------

export type Record_ = { clave: string; icono: string; titulo: string; valor: string; detalle: string; fecha: string | null; numero: number }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
const hms = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const x = Math.round(s % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`
}
const km1 = (n: number) => n.toLocaleString('es-PY', { maximumFractionDigits: 1 })
const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function calcularRecords(h: Historial): Record_[] {
  const r: Record_[] = []
  const conDist = h.sesiones.filter((s) => (s.distancia_km ?? 0) > 0)
  const max = <T,>(xs: T[], f: (x: T) => number) => xs.reduce<T | null>((m, x) => (m === null || f(x) > f(m) ? x : m), null)
  const min = <T,>(xs: T[], f: (x: T) => number) => xs.reduce<T | null>((m, x) => (m === null || f(x) < f(m) ? x : m), null)

  const larga = max(conDist, (s) => s.distancia_km!)
  if (larga) r.push({ clave: 'distancia', icono: '🛣️', titulo: 'Distancia más larga', valor: `${km1(larga.distancia_km!)} km`, detalle: larga.resumen ?? 'Sesión', fecha: larga.fecha, numero: larga.distancia_km! })

  const rapida = min(conDist.filter((s) => s.distancia_km! >= 3 && s.ritmo_prom_seg), (s) => s.ritmo_prom_seg!)
  if (rapida) r.push({ clave: 'ritmo', icono: '⚡', titulo: 'Mejor ritmo (3 km o más)', valor: `${mmss(rapida.ritmo_prom_seg!)}/km`, detalle: `${km1(rapida.distancia_km!)} km`, fecha: rapida.fecha, numero: rapida.ritmo_prom_seg! })

  const splits = h.sesiones.flatMap((s) => s.splits.filter((x) => x.ritmo_seg > 120).map((x) => ({ ...x, fecha: s.fecha })))
  const kmRapido = min(splits, (x) => x.ritmo_seg)
  if (kmRapido) r.push({ clave: 'km', icono: '🚀', titulo: 'Kilómetro más rápido', valor: `${mmss(kmRapido.ritmo_seg)}/km`, detalle: `Km ${kmRapido.km}`, fecha: kmRapido.fecha, numero: kmRapido.ritmo_seg })

  const tiempo = max(h.sesiones.filter((s) => s.duracion_seg), (s) => s.duracion_seg!)
  if (tiempo) r.push({ clave: 'tiempo', icono: '⏱️', titulo: 'Sesión más larga', valor: hms(tiempo.duracion_seg!), detalle: tiempo.resumen ?? 'Sesión', fecha: tiempo.fecha, numero: tiempo.duracion_seg! })

  const semana = max(h.semanas, (s) => s.km_real)
  if (semana && semana.km_real > 0) r.push({ clave: 'semana', icono: '📅', titulo: 'Semana con más km', valor: `${km1(semana.km_real)} km`, detalle: `Semana del ${ddmm(semana.semana_inicio)}`, fecha: semana.semana_inicio, numero: semana.km_real })

  const porMes = new Map<string, number>()
  for (const s of conDist) porMes.set(s.fecha.slice(0, 7), (porMes.get(s.fecha.slice(0, 7)) ?? 0) + s.distancia_km!)
  const mes = max([...porMes.entries()], (x) => x[1])
  if (mes) r.push({ clave: 'mes', icono: '🗓️', titulo: 'Mes con más km', valor: `${km1(mes[1])} km`, detalle: `${MESES[Number(mes[0].slice(5)) - 1]} ${mes[0].slice(0, 4)}`, fecha: `${mes[0]}-01`, numero: mes[1] })

  const subida = max(h.sesiones.filter((s) => s.desnivel_m), (s) => s.desnivel_m!)
  if (subida) r.push({ clave: 'desnivel', icono: '⛰️', titulo: 'Mayor desnivel', valor: `${subida.desnivel_m} m`, detalle: subida.resumen ?? 'Sesión', fecha: subida.fecha, numero: subida.desnivel_m! })

  const { mejor } = rachas(h)
  if (mejor > 0) r.push({ clave: 'racha', icono: '🔥', titulo: 'Mejor racha', valor: `${mejor} semana${mejor === 1 ? '' : 's'}`, detalle: 'Seguidas cumpliendo el plan', fecha: null, numero: mejor })

  for (const d of ['5K', '10K', '21K', '42K']) {
    const m = min(h.marcas.filter((x) => x.distancia === d), (x) => x.tiempo_seg)
    if (m) r.push({ clave: `marca-${d}`, icono: '🏅', titulo: `Marca ${d}`, valor: hms(m.tiempo_seg), detalle: m.carrera ?? 'Marca personal', fecha: m.fecha, numero: m.tiempo_seg })
  }
  return r
}

// ---------- Rachas ----------

export function rachas(h: Historial) {
  const lunes = lunesDe(hoyPY())
  const cerradas = h.semanas.filter((s) => s.semana_inicio < lunes && s.sesiones_plan > 0)
  let mejor = 0
  let actual = 0
  let anterior: string | null = null
  for (const s of cerradas) {
    const cumplio = (s.cumplimiento_pct ?? 0) >= 80
    const seguida = anterior !== null && sumarDias(anterior, 7) === s.semana_inicio
    actual = cumplio ? (seguida ? actual + 1 : 1) : 0
    mejor = Math.max(mejor, actual)
    anterior = s.semana_inicio
  }
  const ultima = cerradas[cerradas.length - 1]
  if (!ultima || sumarDias(ultima.semana_inicio, 7) !== lunes) actual = 0
  return { actual, mejor }
}

// ---------- Retos ----------

export type Reto = { clave: string; icono: string; titulo: string; detalle: string; actual: number; meta: number; unidad: string; cumplido: boolean }

export function calcularRetos(h: Historial): { semana: Reto[]; mes: Reto[] } {
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const mes = primerDiaMes(hoy)
  const est = h.semanas.find((s) => s.semana_inicio === lunes)
  const kmMes = h.sesiones.filter((s) => s.fecha >= mes).reduce((t, s) => t + (s.distancia_km ?? 0), 0)
  const sesMes = h.sesiones.filter((s) => s.fecha >= mes).length
  // Meta mensual a medida: un 10% más que el promedio de los últimos 3 meses (mínimo 40 km).
  const prev = [1, 2, 3].map((k) => {
    const desde = sumarMeses(mes, -k)
    const hasta = sumarMeses(mes, -k + 1)
    return h.sesiones.filter((s) => s.fecha >= desde && s.fecha < hasta).reduce((t, s) => t + (s.distancia_km ?? 0), 0)
  })
  const promedio = prev.reduce((a, b) => a + b, 0) / 3
  const metaKmMes = Math.max(40, Math.round((promedio * 1.1) / 10) * 10)
  const metaSesMes = Math.max(8, Math.round(((h.sesiones.filter((s) => s.fecha >= sumarMeses(mes, -3) && s.fecha < mes).length / 3) * 1.1) || 8))
  const grupales = h.asistencias.filter((a) => a.fecha >= mes).length
  const R = (clave: string, icono: string, titulo: string, detalle: string, actual: number, meta: number, unidad: string): Reto => ({
    clave, icono, titulo, detalle, actual: Math.round(actual * 10) / 10, meta, unidad, cumplido: meta > 0 && actual >= meta,
  })
  return {
    semana: [
      R('plan', '✅', 'Completá tu plan', 'Todas las sesiones de la semana', est?.sesiones_hechas ?? 0, est?.sesiones_plan ?? 0, 'sesiones'),
      R('kmsem', '📏', 'Kilómetros de la semana', 'Los km que planificó tu entrenador', est?.km_real ?? 0, Math.round(est?.km_plan ?? 0), 'km'),
    ].filter((r) => r.meta > 0),
    mes: [
      R('kmmes', '🗓️', `${metaKmMes} km este mes`, 'Un 10% más que tu promedio', kmMes, metaKmMes, 'km'),
      R('sesmes', '💪', `${metaSesMes} sesiones este mes`, 'Constancia ante todo', sesMes, metaSesMes, 'sesiones'),
      R('grupal', '📍', '4 entrenamientos grupales', 'Entrená con el grupo', grupales, 4, 'veces'),
    ],
  }
}

// ---------- Comparar meses ----------

export function resumenMeses(h: Historial, cuantos = 6) {
  const mes = primerDiaMes(hoyPY())
  return Array.from({ length: cuantos }, (_, i) => {
    const desde = sumarMeses(mes, -(cuantos - 1 - i))
    const hasta = sumarMeses(desde, 1)
    const ses = h.sesiones.filter((s) => s.fecha >= desde && s.fecha < hasta)
    const km = ses.reduce((t, s) => t + (s.distancia_km ?? 0), 0)
    const seg = ses.filter((s) => s.distancia_km && s.duracion_seg).reduce((t, s) => t + s.duracion_seg!, 0)
    const kmT = ses.filter((s) => s.distancia_km && s.duracion_seg).reduce((t, s) => t + s.distancia_km!, 0)
    return { mes: MESES[Number(desde.slice(5, 7)) - 1].slice(0, 3), km: Math.round(km * 10) / 10, sesiones: ses.length, ritmo: kmT ? Math.round(seg / kmT) : null }
  })
}
