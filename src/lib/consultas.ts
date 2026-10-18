import { supabase } from './supabase'
import type { Alumno, SemanaCompleta, SesionCompleta, TipoSesion } from './tipos'

// Supabase devuelve las relaciones 1 a 1 como objeto o como lista según la versión.
const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null))

const ordenSesion = (a: SesionCompleta, b: SesionCompleta) => a.fecha.localeCompare(b.fecha) || a.turno - b.turno

/**
 * Planes con sus sesiones, lo registrado y las evaluaciones.
 * Para el alumno, RLS deja pasar solo los planes publicados.
 */
export async function cargarSemanas(opciones: {
  alumnoId?: string
  desde: string // lunes
  hasta: string // lunes
}): Promise<SemanaCompleta[]> {
  let q = supabase
    .from('planes_semanales')
    .select('*, sesiones_planificadas(*, sesiones_registradas(*), evaluaciones(*))')
    .gte('semana_inicio', opciones.desde)
    .lte('semana_inicio', opciones.hasta)
    .order('semana_inicio')
  if (opciones.alumnoId) q = q.eq('alumno_id', opciones.alumnoId)
  const { data, error } = await q
  if (error) throw error

  return (data ?? []).map(({ sesiones_planificadas, ...plan }: any) => ({
    ...plan,
    sesiones: (sesiones_planificadas ?? [])
      .map(({ sesiones_registradas, evaluaciones, ...s }: any) => ({
        ...s,
        registro: uno(sesiones_registradas),
        evaluacion: uno(evaluaciones),
      }))
      .sort(ordenSesion),
  }))
}

let tiposCache: TipoSesion[] | null = null
export async function cargarTipos(): Promise<TipoSesion[]> {
  if (tiposCache) return tiposCache
  const { data } = await supabase.from('tipos_sesion').select('*').order('orden')
  tiposCache = (data ?? []) as TipoSesion[]
  return tiposCache
}

export async function cargarAlumno(id: string): Promise<Alumno | null> {
  const { data } = await supabase.from('alumnos').select('*').eq('id', id).maybeSingle()
  return data as Alumno | null
}

// Mensaje entendible para errores de Supabase.
export function mensajeError(e: unknown, porDefecto = 'No se pudo guardar. Intentá de nuevo.'): string {
  const m = (e as { message?: string; code?: string })?.message ?? ''
  const code = (e as { code?: string })?.code
  if (code === '23505' && m.includes('alumnos_ci')) return 'Ya hay otro alumno con esa CI.'
  if (code === '23505' && m.includes('solicitudes_alta_ci')) return 'Ya hay una solicitud pendiente con esa CI.'
  if (code === '23505') return 'Ya existe un registro igual.'
  if (code === '23503') return 'No se puede borrar: tiene datos asociados (por ejemplo, sesiones registradas o pagos).'
  if (code === '42501') return 'No tenés permiso para hacer esto.'
  if (m.includes('Failed to fetch')) return 'Sin conexión. Revisá internet e intentá de nuevo.'
  if (m && !m.includes('violates') && m.length < 160) return m
  return porDefecto
}
