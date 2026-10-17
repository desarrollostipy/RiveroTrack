// Formatos de Paraguay: Gs. 250.000 · dd/mm · 5:00/km

const dos = (n: number) => String(n).padStart(2, '0')

// Punto de miles siempre (Intl en español no lo pone en números de 4 cifras).
export const formatoGs = (monto: number) =>
  'Gs. ' + Math.round(monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')

// '2026-09-25' → '25/09'
export const formatoFecha = (iso: string) => {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

// 300 → '5:00'
export const formatoRitmo = (seg: number) => `${Math.floor(seg / 60)}:${dos(Math.round(seg % 60))}`

// 3725 → '1:02:05' · 1500 → '25:00'
export const formatoDuracion = (seg: number) => {
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = Math.round(seg % 60)
  return h > 0 ? `${h}:${dos(m)}:${dos(s)}` : `${m}:${dos(s)}`
}

// 12.1 → '12,1'
export const formatoKm = (km: number) => km.toLocaleString('es-PY', { maximumFractionDigits: 1 })
