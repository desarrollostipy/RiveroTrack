// Disciplinas de competencia: running (calle), pista, natación y ciclismo.
// La distancia se guarda siempre en km; pista y natación se muestran en metros.
import { formatoKm, formatoRitmo, leerNumero, miles } from './formato'

export type Disciplina = 'running' | 'pista' | 'natacion' | 'ciclismo'

export const DISCIPLINAS: Record<Disciplina, { emoji: string; nombre: string; resultado: string; unidad: 'km' | 'm'; distancias: number[] }> = {
  running: { emoji: '🏃', nombre: 'Running', resultado: 'RESULTADO DE CARRERA', unidad: 'km', distancias: [5, 10, 21.1, 42.2] },
  pista: { emoji: '🏟️', nombre: 'Pista', resultado: 'RESULTADO EN PISTA', unidad: 'm', distancias: [800, 1500, 3000, 5000, 10000] },
  natacion: { emoji: '🏊', nombre: 'Natación', resultado: 'RESULTADO DE NATACIÓN', unidad: 'm', distancias: [400, 750, 1500, 1900, 3800] },
  ciclismo: { emoji: '🚴', nombre: 'Ciclismo', resultado: 'RESULTADO DE CICLISMO', unidad: 'km', distancias: [20, 40, 90, 180] },
}

export const disciplinaDe = (c: { disciplina?: string | null }): Disciplina => (c.disciplina && c.disciplina in DISCIPLINAS ? (c.disciplina as Disciplina) : 'running')

/** "10 km", "1.500 m", "21,1 km". */
export function textoDistanciaComp(d: Disciplina, km: number | null | undefined) {
  if (!km) return null
  return DISCIPLINAS[d].unidad === 'm' ? `${miles(Number(km) * 1000)} m` : `${formatoKm(Number(km))} km`
}

/** Lo que escribe la persona (en m o km según la disciplina) → km. */
export function leerDistanciaComp(d: Disciplina, texto: string) {
  const n = leerNumero(texto)
  if (n === null) return null
  return DISCIPLINAS[d].unidad === 'm' ? Math.round(n) / 1000 : n
}

/** km → lo que se muestra en el campo (m o km). */
export const valorDistanciaComp = (d: Disciplina, km: number | null | undefined) =>
  !km ? '' : DISCIPLINAS[d].unidad === 'm' ? String(Math.round(Number(km) * 1000)) : String(km).replace('.', ',')

/** Ritmo según la disciplina: min/km (running y pista), min/100 m (natación), km/h (ciclismo). */
export function textoRitmoComp(d: Disciplina, seg: number, km: number | null) {
  if (!seg || !km) return null
  if (d === 'natacion') return `${formatoRitmo(seg / (km * 10))}/100 m`
  if (d === 'ciclismo') return `${(km / (seg / 3600)).toLocaleString('es-PY', { maximumFractionDigits: 1 })} km/h`
  return `${formatoRitmo(seg / km)}/km`
}

/** Mensaje de error si la distancia no tiene sentido para la disciplina (o null si está bien). */
export function errorDistanciaComp(d: Disciplina, km: number | null) {
  if (km === null) return null
  if (km <= 0) return 'Revisá la distancia.'
  if (DISCIPLINAS[d].unidad === 'm' && km < 0.05) return `En ${DISCIPLINAS[d].nombre.toLowerCase()} la distancia va en metros (por ejemplo ${DISCIPLINAS[d].distancias[2]}).`
  if (DISCIPLINAS[d].unidad === 'km' && km > 400) return 'La distancia va en km.'
  return null
}