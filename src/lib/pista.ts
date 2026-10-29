// Pista vuelta por vuelta: el alumno arma la sesión al registrarla (6×800, 4×400, 1×3000…).
// Cada repetición se carga por vueltas de 400 m (la última puede ser más corta: 1000 = 400+400+200)
// y con la recuperación que hizo después. El resumen es por repetición: el promedio de cada 800, etc.
import { textoDistanciaRep, textoTiempo } from './intervalos'

export type RepPista = { vueltas: number[]; rec_seg: number | null }
export type BloquePista = { distancia_m: number; reps: RepPista[] }

export const DISTANCIAS_PISTA = [100, 200, 300, 400, 600, 800, 1000, 1200, 1500, 1600, 2000, 3000, 5000]

/** Tramos de una repetición: vueltas de 400 m y, si sobra, un tramo final más corto. */
export function tramos(distancia_m: number) {
  const t: number[] = []
  for (let r = distancia_m; r > 0; r -= 400) t.push(Math.min(400, r))
  return t
}

/** Tiempo total de una repetición (solo si todas sus vueltas tienen tiempo). */
export function totalRep(r: RepPista, distancia_m: number) {
  const n = tramos(distancia_m).length
  if (r.vueltas.length < n || r.vueltas.slice(0, n).some((v) => !v || v <= 0)) return null
  return r.vueltas.slice(0, n).reduce((a, b) => a + b, 0)
}

const ritmoKm = (seg: number, m: number) => Math.round((seg / m) * 1000)

/** Resumen de un bloque: repeticiones hechas, promedio, mejor, peor y ritmo por km. */
export function resumenBloque(b: BloquePista) {
  const tiempos = b.reps.map((r) => totalRep(r, b.distancia_m)).filter((x): x is number => x !== null)
  const recs = b.reps.map((r) => r.rec_seg).filter((x): x is number => !!x && x > 0)
  if (!tiempos.length) return null
  const total = tiempos.reduce((a, c) => a + c, 0)
  const prom = total / tiempos.length
  return {
    hechas: tiempos.length,
    promedio: Math.round(prom),
    mejor: Math.min(...tiempos),
    peor: Math.max(...tiempos),
    ritmo: ritmoKm(prom, b.distancia_m),
    metros: tiempos.length * b.distancia_m,
    segundos: total,
    recProm: recs.length ? Math.round(recs.reduce((a, c) => a + c, 0) / recs.length) : null,
  }
}

/** Totales de toda la sesión de pista (sin recuperación): km, segundos, ritmo y texto "6×800 · 4×400". */
export function resumenPista(bloques: BloquePista[]) {
  const res = bloques.map((b) => ({ b, r: resumenBloque(b) }))
  const metros = res.reduce((t, x) => t + (x.r?.metros ?? 0), 0)
  const segundos = res.reduce((t, x) => t + (x.r?.segundos ?? 0), 0)
  return {
    km: Math.round(metros) / 1000,
    segundos,
    ritmo: metros ? ritmoKm(segundos, metros) : null,
    texto: res
      .filter((x) => x.r)
      .map((x) => `${x.r!.hechas}×${x.b.distancia_m}`)
      .join(' · '),
  }
}

/** "6×800 m · prom 2:58 (3:43/km) · mejor 2:55 · peor 3:02 · rec 1:30" */
export function textoBloque(b: BloquePista) {
  const r = resumenBloque(b)
  if (!r) return `${b.reps.length}×${textoDistanciaRep(b.distancia_m)}`
  return [
    `${r.hechas}×${textoDistanciaRep(b.distancia_m)}`,
    `prom ${textoTiempo(r.promedio)} (${textoTiempo(r.ritmo)}/km)`,
    r.hechas > 1 ? `mejor ${textoTiempo(r.mejor)} · peor ${textoTiempo(r.peor)}` : null,
    r.recProm ? `rec ${textoTiempo(r.recProm)}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Lo que viene de la base (por si llega algo raro, se limpia). */
export function leerBloques(x: unknown): BloquePista[] {
  if (!Array.isArray(x)) return []
  return x
    .filter((b) => b && typeof b.distancia_m === 'number' && Array.isArray(b.reps))
    .map((b) => ({
      distancia_m: b.distancia_m,
      reps: b.reps.map((r: { vueltas?: unknown; rec_seg?: unknown }) => ({
        vueltas: Array.isArray(r.vueltas) ? r.vueltas.map((v) => Number(v) || 0) : [],
        rec_seg: typeof r.rec_seg === 'number' ? r.rec_seg : null,
      })),
    }))
}
