// Fechas como texto 'AAAA-MM-DD', siempre con la hora de Asunción.
// Trabajar con texto evita corrimientos de un día por zona horaria.

export const ZONA = 'America/Asuncion'

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`)
const aIso = (d: Date) => d.toISOString().slice(0, 10)

export function hoyPY(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
}

export function sumarDias(iso: string, dias: number): string {
  const d = aFecha(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return aIso(d)
}

export function sumarMeses(iso: string, meses: number): string {
  const d = aFecha(iso)
  d.setUTCMonth(d.getUTCMonth() + meses)
  return aIso(d)
}

// Días de 'desde' a 'hasta' (positivo si hasta es posterior).
export const diasEntre = (desde: string, hasta: string) =>
  Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 864e5)

// 0 = lunes … 6 = domingo
export const diaSemana = (iso: string) => (aFecha(iso).getUTCDay() + 6) % 7

export const lunesDe = (iso: string) => sumarDias(iso, -diaSemana(iso))

export const primerDiaMes = (iso: string) => iso.slice(0, 8) + '01'

export const diasDeSemana = (lunes: string) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// '2026-09-25' → 'viernes 25 de septiembre'
export function fechaLarga(iso: string): string {
  const d = aFecha(iso)
  return `${DIAS[diaSemana(iso)].toLowerCase()} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

// '2026-09-01' → 'Septiembre'
export const nombreMes = (iso: string) => capitalizar(MESES[aFecha(iso).getUTCMonth()])

// '2026-09-21' → '21 sep – 27 sep'
export function rangoSemana(lunes: string): string {
  const corto = (iso: string) => {
    const d = aFecha(iso)
    return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`
  }
  return `${corto(lunes)} – ${corto(sumarDias(lunes, 6))}`
}

export function edad(nacimiento: string | null, hoy: string): number | null {
  if (!nacimiento) return null
  let anios = Number(hoy.slice(0, 4)) - Number(nacimiento.slice(0, 4))
  if (hoy.slice(5) < nacimiento.slice(5)) anios--
  return anios
}

// 'hoy', 'ayer', 'hace 3 días'
export function haceDias(dias: number): string {
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  return `hace ${dias} días`
}
