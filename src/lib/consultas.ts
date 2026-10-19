import { supabase } from './supabase'
import type { Alumno, SemanaCompleta, SesionCompleta, TipoSesion } from './tipos'

// Supabase devuelve las relaciones 1 a 1 como objeto o como lista según la versión.
const uno = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null))

const ordenSesion = (a: SesionCompleta, b: SesionCompleta) => a.fecha.localeCompare(b.fecha) || a.turno - b.turno

/**
 * Planes con sus sesiones, lo registrado y las evaluaciones.
 * Para el alumno, RLS deja pasar solo los planes publicados.
 */
// Última respuesta de cada consulta, para mostrar algo al instante
// mientras se actualiza de fondo.
const memoria = new Map<string, SemanaCompleta[]>()
export const semanasEnMemoria = (o: { alumnoId?: string; desde: string; hasta: string }) =>
  memoria.get(`${o.alumnoId ?? '*'}|${o.desde}|${o.hasta}`)

export async function cargarSemanas(opciones: {
  alumnoId?: string
  desde: string // lunes
  hasta: string // lunes
}): Promise<SemanaCompleta[]> {
  const clave = `${opciones.alumnoId ?? '*'}|${opciones.desde}|${opciones.hasta}`
  const r = await consultarSemanas(opciones)
  memoria.set(clave, r)
  return r
}

let sinFuncionRapida = false

async function consultarSemanas(opciones: { alumnoId?: string; desde: string; hasta: string }): Promise<SemanaCompleta[]> {
  // De un alumno: una sola consulta en la base (más rápida).
  if (opciones.alumnoId && !sinFuncionRapida) {
    const { data, error } = await supabase.rpc('semanas_completas', {
      p_alumno_id: opciones.alumnoId,
      p_desde: opciones.desde,
      p_hasta: opciones.hasta,
    })
    if (!error) {
      return ((data ?? []) as SemanaCompleta[]).map((p) => ({ ...p, sesiones: p.sesiones ?? [] }))
    }
    // Si todavía no se corrió el SQL de la función, se usa la consulta de siempre.
    if (error.code === 'PGRST202' || error.message?.includes('semanas_completas')) sinFuncionRapida = true
    else throw error
  }

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
