// Salud y seguimiento: bienestar, molestias, zonas de pulso, zapatillas, metas
// y carga de entrenamiento. Todo se calcula en el celular con lo que ya hay.
import { edad } from './fechas'
import type { Split } from './tipos'

// ---------- Tipos de las tablas ----------
export type Bienestar = { id: string; alumno_id: string; fecha: string; sueno: number; energia: number; dolor: number; animo: number; nota: string | null }
export type Molestia = { id: string; alumno_id: string; fecha: string; zona: ZonaCuerpo; lado: 'izq' | 'der' | 'ambos' | null; intensidad: number; nota: string | null; resuelta_at: string | null }
export type Calzado = { id: string; alumno_id: string; nombre: string; km_inicial: number; limite_km: number; principal: boolean; retirada: boolean; km_total: number }
export type Meta = {
  id: string
  alumno_id: string
  titulo: string
  tipo: 'tiempo' | 'km' | 'libre'
  distancia: '5K' | '10K' | '21K' | '42K' | null
  objetivo_seg: number | null
  objetivo_km: number | null
  desde: string
  fecha_limite: string | null
  cumplida_at: string | null
}
export type FichaMedica = {
  alumno_id: string
  grupo_sanguineo: string | null
  alergias: string | null
  condiciones: string | null
  medicacion: string | null
  seguro_medico: string | null
  contacto_nombre: string | null
  contacto_relacion: string | null
  contacto_telefono: string | null
}

// ---------- Diario de bienestar ----------
/** Cada pregunta con sus 5 respuestas, de peor a mejor (en dolor, 1 = nada). */
export const PREGUNTAS_BIENESTAR = [
  { campo: 'sueno', titulo: '¿Cómo dormiste?', opciones: ['😫', '😪', '😐', '🙂', '😴'], textos: ['Muy mal', 'Mal', 'Normal', 'Bien', 'Excelente'] },
  { campo: 'energia', titulo: '¿Cómo está tu energía?', opciones: ['🪫', '😩', '😐', '💪', '⚡'], textos: ['Agotado', 'Cansado', 'Normal', 'Con ganas', 'A full'] },
  { campo: 'dolor', titulo: '¿Algún dolor?', opciones: ['😀', '🙂', '😐', '😣', '😖'], textos: ['Nada', 'Leve', 'Algo', 'Bastante', 'Mucho'] },
  { campo: 'animo', titulo: '¿Cómo está tu ánimo?', opciones: ['😞', '😕', '😐', '😊', '🤩'], textos: ['Bajo', 'Regular', 'Normal', 'Bien', 'Excelente'] },
] as const

/** Puntaje de 0 a 100: 100 = durmió bien, con energía, sin dolor y de buen ánimo. */
export function puntajeBienestar(b: Pick<Bienestar, 'sueno' | 'energia' | 'dolor' | 'animo'>) {
  const total = b.sueno + b.energia + (6 - b.dolor) + b.animo // de 4 a 20
  return Math.round(((total - 4) / 16) * 100)
}

export function colorPuntaje(p: number) {
  return p >= 70 ? 'ok' : p >= 45 ? 'parcial' : 'mal'
}

// ---------- Molestias ----------
export type ZonaCuerpo =
  | 'cuello' | 'hombro' | 'espalda_alta' | 'lumbar' | 'cadera' | 'gluteo' | 'ingle' | 'cuadriceps'
  | 'isquiotibiales' | 'rodilla' | 'tibia' | 'gemelo' | 'aquiles' | 'tobillo' | 'pie' | 'otra'

export const ZONAS: Record<ZonaCuerpo, string> = {
  cuello: 'Cuello', hombro: 'Hombro', espalda_alta: 'Espalda alta', lumbar: 'Lumbar', cadera: 'Cadera',
  gluteo: 'Glúteo', ingle: 'Ingle', cuadriceps: 'Cuádriceps', isquiotibiales: 'Isquiotibiales', rodilla: 'Rodilla',
  tibia: 'Tibia (canilla)', gemelo: 'Gemelo', aquiles: 'Tendón de Aquiles', tobillo: 'Tobillo', pie: 'Pie / planta', otra: 'Otra',
}
export const LADOS = { izq: 'izquierda', der: 'derecha', ambos: 'ambos lados' } as const

export function textoMolestia(m: Pick<Molestia, 'zona' | 'lado'>) {
  return `${ZONAS[m.zona]}${m.lado ? ` ${LADOS[m.lado]}` : ''}`
}

/** Activa = sin resolver. */
export const activa = (m: Molestia) => !m.resuelta_at

// ---------- Zonas de pulso ----------
export type ZonaPulso = { numero: number; nombre: string; desc: string; min: number; max: number; color: string }

const DEF_ZONAS = [
  { nombre: 'Recuperación', desc: 'Muy suave, regenerativo', desde: 0.5, hasta: 0.6, color: '#76819A' },
  { nombre: 'Base aeróbica', desc: 'Rodajes y fondos cómodos', desde: 0.6, hasta: 0.7, color: '#1F9D6A' },
  { nombre: 'Tempo', desc: 'Ritmo sostenido', desde: 0.7, hasta: 0.8, color: '#D9A032' },
  { nombre: 'Umbral', desc: 'Exigente, series largas', desde: 0.8, hasta: 0.9, color: '#E8590C' },
  { nombre: 'Máximo', desc: 'Series cortas, finales', desde: 0.9, hasta: 1, color: '#C92A2A' },
]

/**
 * Pulso máximo a usar: el que cargó el alumno o el entrenador; si no hay,
 * se estima por la edad (fórmula de Tanaka: 208 − 0,7 × edad).
 */
export function pulsoMaximo(a: { fc_max: number | null; fecha_nacimiento: string | null }, hoy: string) {
  if (a.fc_max) return { valor: a.fc_max, estimado: false }
  const anios = edad(a.fecha_nacimiento, hoy)
  return anios ? { valor: Math.round(208 - 0.7 * anios), estimado: true } : null
}

/** Zonas por % del pulso máximo; con pulso de reposo se usa la reserva (Karvonen). */
export function zonasPulso(fcMax: number, fcReposo?: number | null): ZonaPulso[] {
  const calc = (pct: number) => Math.round(fcReposo ? fcReposo + pct * (fcMax - fcReposo) : pct * fcMax)
  return DEF_ZONAS.map((z, i) => ({ numero: i + 1, nombre: z.nombre, desc: z.desc, color: z.color, min: calc(z.desde), max: i === 4 ? fcMax : calc(z.hasta) - 1 }))
}

export function zonaDe(fc: number, zonas: ZonaPulso[]) {
  if (fc < zonas[0].min) return zonas[0]
  return zonas.find((z) => fc >= z.min && fc <= z.max) ?? zonas[zonas.length - 1]
}

/** Segundos en cada zona. Con pulso por km usa cada parcial; si no, toda la sesión va a la zona del promedio. */
export function tiempoEnZonas(s: { splits: Split[]; fc_prom: number | null; duracion_seg: number | null }, zonas: ZonaPulso[]) {
  const seg = zonas.map(() => 0)
  const conPulso = s.splits.filter((p) => p.fc)
  if (conPulso.length) for (const p of conPulso) seg[zonaDe(p.fc!, zonas).numero - 1] += p.tiempo_seg
  else if (s.fc_prom && s.duracion_seg) seg[zonaDe(s.fc_prom, zonas).numero - 1] += s.duracion_seg
  return { seg, porKm: conPulso.length > 0 }
}

// ---------- Zapatillas ----------
export function estadoCalzado(c: Pick<Calzado, 'km_total' | 'limite_km'>) {
  const pct = c.km_total / c.limite_km
  return { pct, aviso: pct >= 1 ? 'cambiar' : pct >= 0.85 ? 'pronto' : null } as const
}

// ---------- Carga de entrenamiento ----------
/**
 * Semáforo de carga: km de la última semana contra el promedio de las 4 anteriores.
 * Subir más de 30% de golpe aumenta el riesgo de lesión; bajar mucho puede ser desánimo o molestia.
 */
export function semaforoCarga(kmSemanas: number[]) {
  // kmSemanas: de la más vieja a la más nueva; la última es la semana pasada completa.
  const ultima = kmSemanas[kmSemanas.length - 1] ?? 0
  const previas = kmSemanas.slice(-5, -1).filter((k) => k > 0)
  if (previas.length < 2) return { color: 'gris' as const, texto: 'Pocos datos', ratio: null, ultima }
  const prom = previas.reduce((t, k) => t + k, 0) / previas.length
  const ratio = prom ? ultima / prom : null
  if (ratio === null) return { color: 'gris' as const, texto: 'Pocos datos', ratio, ultima }
  if (ratio > 1.3) return { color: 'rojo' as const, texto: `Subió ${Math.round((ratio - 1) * 100)}% de golpe`, ratio, ultima }
  if (ratio < 0.6) return { color: 'amarillo' as const, texto: `Bajó ${Math.round((1 - ratio) * 100)}%`, ratio, ultima }
  return { color: 'verde' as const, texto: 'Carga estable', ratio, ultima }
}
