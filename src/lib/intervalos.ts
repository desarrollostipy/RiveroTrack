// Sesiones por repeticiones (pista y series): 15×400 en 1:44–1:48, rec 1:30 trotando.
// El alumno carga cuántas hizo y la vuelta promedio; la distancia y el tiempo
// "sin recuperación" salen solos.

export type RecTipo = 'trote' | 'caminando' | 'parado'
export const REC_TIPOS: { valor: RecTipo; texto: string }[] = [
  { valor: 'trote', texto: 'Trotando' },
  { valor: 'caminando', texto: 'Caminando' },
  { valor: 'parado', texto: 'Parado' },
]

type ConReps = {
  reps?: number | null
  rep_m?: number | null
  rep_seg_min?: number | null
  rep_seg_max?: number | null
  rec_seg?: number | null
  rec_tipo?: RecTipo | null
}

/** Pista y series se cargan por repeticiones. */
export const esIntervalos = (codigoTipo: string) => /pista|serie|interval/i.test(codigoTipo)

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
export const textoTiempo = mmss

/** "400 m" o "1 km" / "1,6 km". */
export const textoDistanciaRep = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('es-PY', { maximumFractionDigits: 2 })} km` : `${m} m`)

/** "15×400 m · 1:44–1:48 · rec 1:30 trotando" */
export function textoReps(s: ConReps) {
  if (!s.reps || !s.rep_m) return null
  const partes = [`${s.reps}×${textoDistanciaRep(s.rep_m)}`]
  if (s.rep_seg_min || s.rep_seg_max) {
    const a = s.rep_seg_min ?? s.rep_seg_max!
    const b = s.rep_seg_max ?? s.rep_seg_min!
    partes.push(a === b ? `@${mmss(a)}` : `@${mmss(a)}–${mmss(b)}`)
  }
  if (s.rec_seg) partes.push(`rec ${mmss(s.rec_seg)}${s.rec_tipo ? ` ${REC_TIPOS.find((r) => r.valor === s.rec_tipo)?.texto.toLowerCase()}` : ''}`)
  return partes.join(' · ')
}

/** Km de las repeticiones (sin calentamiento ni recuperación). */
export const kmReps = (reps: number, repM: number) => Math.round(reps * repM) / 1000

/** Tiempo por repetición → ritmo por km. */
export const ritmoDeVuelta = (seg: number, repM: number) => Math.round((seg / repM) * 1000)

/** ¿La vuelta promedio cayó en el rango que pidió el entrenador? */
export function compararVuelta(prom: number, min?: number | null, max?: number | null) {
  if (!min && !max) return null
  const a = min ?? max!
  const b = max ?? min!
  if (prom < a - 1) return 'rapido' as const
  if (prom > b + 1) return 'lento' as const
  return 'en_rango' as const
}
