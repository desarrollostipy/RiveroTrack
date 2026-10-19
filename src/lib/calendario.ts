import { kmPlanificados } from './calculos'
import { formatoRango } from './formato'
import type { SesionPlan } from './tipos'

// Archivo de calendario (.ics) con los entrenamientos: al abrirlo, el
// celular ofrece agregarlos a Google Calendar o al calendario del iPhone.

const CLAVE_HORA = 'rivero-hora-entreno'
export const horaGuardada = () => {
  try {
    return localStorage.getItem(CLAVE_HORA) || '06:00'
  } catch {
    return '06:00'
  }
}
export const guardarHora = (h: string) => {
  try {
    localStorage.setItem(CLAVE_HORA, h)
  } catch {
    // sin almacenamiento
  }
}

const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
// Hora de Paraguay (UTC−3 todo el año) → UTC en formato iCalendar.
function enUtc(fecha: string, hora: string, sumarMin = 0) {
  const [h, m] = hora.split(':').map(Number)
  const d = new Date(Date.UTC(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, Number(fecha.slice(8, 10)), h + 3, m + sumarMin))
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
}

export function archivoCalendario(sesiones: (SesionPlan & { nombreTipo: string })[], horaMañana: string, horaTarde = '18:00') {
  const ahora = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const eventos = sesiones
    .filter((s) => s.tipo !== 'descanso')
    .map((s) => {
      const hora = s.turno === 2 ? horaTarde : horaMañana
      const km = kmPlanificados(s).km
      const minutos = s.duracion_min ?? (km ? Math.round(km * 6.5) : 60)
      const detalle = [
        s.resumen,
        s.distancia_km ? `Distancia: ${s.distancia_km} km` : null,
        s.duracion_min ? `Duración: ${s.duracion_min} min` : null,
        s.ritmo_min_seg || s.ritmo_max_seg ? `Ritmo: ${formatoRango(s.ritmo_min_seg, s.ritmo_max_seg)} /km` : null,
        s.fc_obj_min || s.fc_obj_max ? `Pulso: ${s.fc_obj_min ? s.fc_obj_min + '–' : 'hasta '}${s.fc_obj_max ?? ''} ppm` : null,
        s.estructura,
        s.notas ? `Notas: ${s.notas}` : null,
      ]
        .filter(Boolean)
        .join('\n')
      return [
        'BEGIN:VEVENT',
        `UID:rivero-${s.id}@rivero.app`,
        `DTSTAMP:${ahora}`,
        `DTSTART:${enUtc(s.fecha, hora)}`,
        `DTEND:${enUtc(s.fecha, hora, minutos)}`,
        `SUMMARY:${escapar(`🏃 ${s.nombreTipo}: ${s.resumen || s.nombreTipo}`)}`,
        `DESCRIPTION:${escapar(detalle)}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        'DESCRIPTION:Entrenamiento Rivero',
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n')
    })
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Rivero Track & Field//ES', 'CALSCALE:GREGORIAN', ...eventos, 'END:VCALENDAR'].join('\r\n')
}

export function descargar(nombre: string, contenido: string, tipo = 'text/calendar;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
