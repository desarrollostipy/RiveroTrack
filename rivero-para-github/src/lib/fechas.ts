// Fechas como texto 'AAAA-MM-DD', siempre con la hora de Asunción.
// Trabajar con texto evita corrimientos de un día por zona horaria.

export const ZONA = 'America/Asuncion'

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
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

// 0 = lunes … 6 = domingo
export const diaSemana = (iso: string) => (aFecha(iso).getUTCDay() + 6) % 7

export const lunesDe = (iso: string) => sumarDias(iso, -diaSemana(iso))

// '2026-09-25' → 'viernes 25 de septiembre'
export function fechaLarga(iso: string): string {
  const d = aFecha(iso)
  return `${DIAS[diaSemana(iso)].toLowerCase()} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`
}

// '2026-09-21' → '21 sep – 27 sep'
export function rangoSemana(lunes: string): string {
  const corto = (iso: string) => {
    const d = aFecha(iso)
    return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)}`
  }
  return `${corto(lunes)} – ${corto(sumarDias(lunes, 6))}`
}
