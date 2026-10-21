// Actividades extra (fuera del plan) y km totales de una sesión con calentamiento y afloje.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Deporte = 'natacion' | 'bicicleta' | 'gimnasio' | 'caminata' | 'yoga' | 'futbol' | 'padel' | 'otro'
export type ActividadExtra = {
  id: string
  alumno_id: string
  fecha: string
  deporte: Deporte
  nombre: string | null
  duracion_min: number
  distancia_km: number | null
  fc_prom: number | null
  sensacion: number | null
  comentario: string | null
}

export const DEPORTES: Record<Deporte, { emoji: string; nombre: string; distancia: 'km' | 'm' | null }> = {
  natacion: { emoji: '🏊', nombre: 'Natación', distancia: 'm' },
  bicicleta: { emoji: '🚴', nombre: 'Bicicleta', distancia: 'km' },
  gimnasio: { emoji: '🏋️', nombre: 'Gimnasio / fuerza', distancia: null },
  caminata: { emoji: '🚶', nombre: 'Caminata', distancia: 'km' },
  yoga: { emoji: '🧘', nombre: 'Yoga / estiramiento', distancia: null },
  futbol: { emoji: '⚽', nombre: 'Fútbol', distancia: null },
  padel: { emoji: '🎾', nombre: 'Pádel / tenis', distancia: null },
  otro: { emoji: '✨', nombre: 'Otra', distancia: 'km' },
}

export const nombreActividad = (a: Pick<ActividadExtra, 'deporte' | 'nombre'>) => (a.deporte === 'otro' && a.nombre ? a.nombre : DEPORTES[a.deporte].nombre)

/** "1.500 m" para natación, "25 km" para el resto. */
export function textoDistancia(a: Pick<ActividadExtra, 'deporte' | 'distancia_km'>) {
  if (!a.distancia_km) return null
  return DEPORTES[a.deporte].distancia === 'm'
    ? `${Math.round(Number(a.distancia_km) * 1000).toLocaleString('es-PY')} m`
    : `${Number(a.distancia_km).toLocaleString('es-PY', { maximumFractionDigits: 1 })} km`
}

/** Actividades extra de un alumno entre dos fechas (incluidas). */
export function useExtras(alumnoId: string, desde: string, hasta: string) {
  const [lista, setLista] = useState<ActividadExtra[]>([])
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('actividades_extra').select('*').eq('alumno_id', alumnoId).gte('fecha', desde).lte('fecha', hasta).order('created_at')
    setLista((data ?? []) as ActividadExtra[])
  }, [alumnoId, desde, hasta])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { extras: lista, recargarExtras: cargar }
}

/** Km corridos en una sesión: parte principal + calentamiento + afloje. */
export function kmCorridos(r: { distancia_km: number | null; calentamiento_km?: number | null; afloje_km?: number | null } | null | undefined) {
  if (!r) return 0
  return Number(r.distancia_km ?? 0) + Number(r.calentamiento_km ?? 0) + Number(r.afloje_km ?? 0)
}
