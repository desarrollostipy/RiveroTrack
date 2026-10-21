// Formatos de Paraguay: Gs. 250.000 · dd/mm · 5:00/km

const dos = (n: number) => String(n).padStart(2, '0')

// Punto de miles siempre (Intl en español no lo pone en números de 4 cifras).
export const miles = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

export const formatoGs = (monto: number) => 'Gs. ' + miles(monto)

// '2026-09-25' → '25/09'
export const formatoFecha = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

// 300 → '5:00'
export const formatoRitmo = (seg: number) => {
  const s = Math.round(seg)
  return `${Math.floor(s / 60)}:${dos(s % 60)}`
}

export const formatoRango = (min: number | null, max: number | null) => {
  if (min && max) return `${formatoRitmo(min)}–${formatoRitmo(max)}`
  if (min || max) return formatoRitmo((min ?? max)!)
  return ''
}

// Pulso objetivo: '130 ppm' · '125–135 ppm' · '' si no hay
export const formatoPpm = (min: number | null, max: number | null) => {
  if (min && max && min !== max) return `${min}–${max} ppm`
  if (min || max) return `${max ?? min} ppm`
  return ''
}

// 3725 → '1:02:05' · 1500 → '25:00'
export const formatoDuracion = (seg: number) => {
  const t = Math.round(seg)
  const h = Math.floor(t / 3600)
  const m = Math.floor((t % 3600) / 60)
  const s = t % 60
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`
}

// 12.1 → '12,1'
export const formatoKm = (km: number) => km.toLocaleString('es-PY', { maximumFractionDigits: 1 })

export const formatoPeso = (kg: number) => kg.toLocaleString('es-PY', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Variación con signo: −0,6 / +1,2
export const conSigno = (n: number, decimales = 1) =>
  (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString('es-PY', { maximumFractionDigits: decimales })

// '5:20' → 320 · '' → null
export function leerRitmo(texto: string): number | null {
  const m = texto.trim().match(/^(\d{1,2})[:.,'](\d{2})$/)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

// '1:02:05' / '45:30' / '45' (minutos) → segundos
export function leerDuracion(texto: string): number | null {
  const partes = texto.trim().split(':').map((p) => p.trim())
  if (partes.some((p) => !/^\d+$/.test(p))) return null
  const n = partes.map(Number)
  if (n.length === 1) return n[0] * 60
  if (n.length === 2) return n[0] * 60 + n[1]
  if (n.length === 3) return n[0] * 3600 + n[1] * 60 + n[2]
  return null
}

// '12,5' → 12.5
export function leerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// 'Gs. 250.000' / '250000' → 250000
export const leerMonto = (texto: string) => {
  const n = Number(texto.replace(/\D/g, ''))
  return Number.isFinite(n) ? n : 0
}
