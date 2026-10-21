// Motivación y comunidad: ranking, desafíos del mes, eventos, resumen del año
// y modo carrera (estrategia de ritmos y clima).
import { hoyPY, sumarMeses } from './fechas'
import { rachas, type Historial } from './historial'

// ---------- Tipos ----------
export type FilaRanking = { alumno_id: string; nombre: string; avatar_url: string | null; km: number; sesiones: number; dias: number; es_yo: boolean; visible: boolean }
export type TipoDesafio = 'km' | 'sesiones' | 'dias' | 'grupales'
export type Desafio = { id: string; titulo: string; emoji: string; descripcion: string | null; mes: string; tipo: TipoDesafio; meta: number; grupo_id: string | null }
export type Evento = {
  id: string
  titulo: string
  descripcion: string | null
  fecha: string
  hora: string | null
  lugar: string | null
  cupo: number | null
  costo: number | null
  cierre: string | null
  grupo_id: string | null
}
export type CupoEvento = { evento_id: string; anotados: number; yo: boolean }
export type PlantillaMensaje = { id: string; titulo: string; texto: string }

// ---------- Desafíos del mes ----------
export const TIPOS_DESAFIO: Record<TipoDesafio, { texto: string; unidad: string }> = {
  km: { texto: 'Kilómetros en el mes', unidad: 'km' },
  sesiones: { texto: 'Sesiones registradas', unidad: 'sesiones' },
  dias: { texto: 'Días distintos entrenando', unidad: 'días' },
  grupales: { texto: 'Entrenamientos grupales', unidad: 'veces' },
}

/** Avance de un alumno en un desafío, con su propio historial. */
export function avanceDesafio(d: Pick<Desafio, 'mes' | 'tipo' | 'meta'>, h: Historial) {
  const hasta = sumarMeses(d.mes, 1)
  const ses = h.sesiones.filter((s) => s.fecha >= d.mes && s.fecha < hasta)
  const actual =
    d.tipo === 'km'
      ? ses.reduce((t, s) => t + s.km_total, 0)
      : d.tipo === 'sesiones'
        ? ses.length
        : d.tipo === 'dias'
          ? new Set(ses.map((s) => s.fecha)).size
          : h.asistencias.filter((a) => a.fecha >= d.mes && a.fecha < hasta).length
  const meta = Number(d.meta)
  return { actual: Math.round(actual * 10) / 10, meta, pct: Math.min(1, actual / meta), cumplido: actual >= meta }
}

// ---------- Resumen del año ("Wrapped") ----------
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

export function resumenAnio(h: Historial, anio: number) {
  const ses = h.sesiones.filter((s) => s.fecha.startsWith(String(anio)))
  const km = ses.reduce((t, s) => t + s.km_total, 0)
  const seg = ses.reduce((t, s) => t + (s.duracion_seg ?? 0), 0)
  const conRitmo = ses.filter((s) => s.distancia_km && s.duracion_seg)
  const kmR = conRitmo.reduce((t, s) => t + s.distancia_km!, 0)
  const porMes = MESES_CORTOS.map((m, i) => {
    const pref = `${anio}-${String(i + 1).padStart(2, '0')}`
    return { mes: m, km: Math.round(ses.filter((s) => s.fecha.startsWith(pref)).reduce((t, s) => t + s.km_total, 0)) }
  })
  const mejorMes = porMes.reduce((a, b) => (b.km > a.km ? b : a), porMes[0])
  const larga = ses.reduce<(typeof ses)[number] | null>((a, s) => (s.km_total > (a?.km_total ?? 0) ? s : a), null)
  const carreras = h.carreras.filter((c) => c.fecha.startsWith(String(anio)) && c.resultado_tiempo_seg)
  return {
    anio,
    km: Math.round(km * 10) / 10,
    sesiones: ses.length,
    horas: Math.round(seg / 3600),
    dias: new Set(ses.map((s) => s.fecha)).size,
    ritmo: kmR ? Math.round(conRitmo.reduce((t, s) => t + s.duracion_seg!, 0) / kmR) : null,
    porMes,
    mejorMes: mejorMes.km > 0 ? { nombre: MESES_LARGOS[MESES_CORTOS.indexOf(mejorMes.mes)], km: mejorMes.km } : null,
    larga: larga?.km_total ? { km: Math.round(larga.km_total * 10) / 10, fecha: larga.fecha } : null,
    carreras: carreras.length,
    grupales: h.asistencias.filter((a) => a.fecha.startsWith(String(anio))).length,
    racha: rachas(h).mejor,
    // Para dimensionar: Asunción–Encarnación son unos 370 km por ruta.
    encarnaciones: Math.round((km / 370) * 10) / 10,
  }
}

// ---------- Modo carrera ----------
/**
 * Estrategia "de menos a más" (negative split): el primer cuarto 5 s/km más lento,
 * el último cuarto 5 s/km más rápido y el medio al ritmo objetivo. El total da el objetivo.
 */
export function estrategiaCarrera(distanciaKm: number, objetivoSeg: number) {
  const ritmo = objetivoSeg / distanciaKm
  const cuarto = distanciaKm / 4
  const tramos = [
    { nombre: 'Salida controlada', desde: 0, hasta: cuarto, ritmo: ritmo + 5, consejo: 'No te dejes llevar por la largada.' },
    { nombre: 'Ritmo de carrera', desde: cuarto, hasta: distanciaKm - cuarto, ritmo, consejo: 'Cómodo y constante. Hidratate.' },
    { nombre: 'Cierre', desde: distanciaKm - cuarto, hasta: distanciaKm, ritmo: ritmo - 5, consejo: '¡Ahora sí, a apretar!' },
  ]
  // Tiempos de paso: cada km hasta 10K, cada 5 km en distancias largas.
  const paso = distanciaKm <= 10 ? 1 : 5
  const marcas: number[] = []
  for (let k = paso; k < distanciaKm; k += paso) marcas.push(k)
  marcas.push(distanciaKm)
  const tiempoHasta = (km: number) =>
    tramos.reduce((t, tr) => t + Math.max(0, Math.min(km, tr.hasta) - tr.desde) * tr.ritmo, 0)
  return { ritmo, tramos, parciales: marcas.map((km) => ({ km, seg: Math.round(tiempoHasta(km)) })) }
}

export type Clima = { lugar: string; temp: number; sensacion: number; lluvia: number; viento: number; humedad: number; consejos: string[] }

/**
 * Pronóstico para el lugar y la hora de largada (Open-Meteo, sin clave).
 * Solo hay pronóstico hasta unos 15 días antes.
 */
export async function climaCarrera(lugar: string | null, fecha: string, hora: string | null): Promise<Clima | null> {
  const dias = (new Date(fecha).getTime() - new Date(hoyPY()).getTime()) / 86_400_000
  if (dias < 0 || dias > 15) return null
  let lat = -25.2637
  let lon = -57.5759
  let nombre = 'Asunción'
  try {
    if (lugar) {
      const g = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(lugar.split(',')[0])}&count=1&language=es&countryCode=PY`).then((r) => r.json())
      if (g.results?.[0]) ({ latitude: lat, longitude: lon, name: nombre } = g.results[0])
    }
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=America%2FAsuncion&start_date=${fecha}&end_date=${fecha}` +
      '&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,relative_humidity_2m'
    const d = await fetch(url).then((r) => r.json())
    const h = Number((hora ?? '07:00').slice(0, 2))
    const v = (k: string) => Math.round(d.hourly?.[k]?.[h] ?? NaN)
    const c: Clima = { lugar: nombre, temp: v('temperature_2m'), sensacion: v('apparent_temperature'), lluvia: v('precipitation_probability'), viento: v('wind_speed_10m'), humedad: v('relative_humidity_2m'), consejos: [] }
    if (Number.isNaN(c.temp)) return null
    if (c.sensacion >= 27) c.consejos.push('Calor: salí 5–10 s/km más lento de lo planeado e hidratate en cada puesto.')
    if (c.sensacion <= 12) c.consejos.push('Fresco: llevá una remera vieja para la previa y descartala al largar.')
    if (c.lluvia >= 50) c.consejos.push('Probable lluvia: vaselina en los pies y una bolsa para la ropa seca.')
    if (c.viento >= 20) c.consejos.push('Viento fuerte: buscá ir a resguardo detrás de otros corredores.')
    if (c.humedad >= 80) c.consejos.push('Mucha humedad: cuidá la hidratación y las sales.')
    if (!c.consejos.length) c.consejos.push('Clima ideal para correr. ¡A disfrutarla!')
    return c
  } catch {
    return null
  }
}
