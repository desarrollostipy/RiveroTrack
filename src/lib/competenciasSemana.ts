// Competencias con resultado dentro de un rango de fechas, para sumarlas a la semana
// (km de running y pista, y calorías de todas).
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { disciplinaDe, type Disciplina } from './disciplinas'

export type CompetenciaHecha = {
  id: string
  nombre: string
  fecha: string
  disciplina: Disciplina
  km: number | null
  tiempo_seg: number
}

/** Competencias aprobadas con tiempo cargado entre dos fechas. */
export async function cargarCompetenciasHechas(alumnoId: string, desde: string, hasta: string): Promise<CompetenciaHecha[]> {
  // Si la base todavía no tiene las columnas nuevas, se piden las de siempre.
  const q = (c: string) =>
    supabase.from('competencias').select(c).eq('alumno_id', alumnoId).eq('estado', 'aprobada').not('resultado_tiempo_seg', 'is', null).gte('fecha', desde).lte('fecha', hasta)
  let r = await q('id, nombre, fecha, distancia_km, resultado_tiempo_seg, resultado_distancia_km, disciplina')
  if (r.error) r = await q('id, nombre, fecha, distancia_km, resultado_tiempo_seg')
  return ((r.data ?? []) as unknown as Record<string, any>[]).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    fecha: c.fecha,
    disciplina: disciplinaDe(c),
    km: Number(c.resultado_distancia_km ?? c.distancia_km ?? 0) || null,
    tiempo_seg: c.resultado_tiempo_seg,
  }))
}

/**
 * ¿Ya está contada como sesión? Si ese día se registró una sesión de distancia
 * parecida (±15 %), es la misma carrera y no se suma dos veces.
 */
export const yaRegistrada = (c: CompetenciaHecha, sesiones: { fecha: string; distancia_km: number | null }[]) =>
  !!c.km && sesiones.some((s) => s.fecha === c.fecha && Math.abs(Number(s.distancia_km ?? 0) - c.km!) <= 0.15 * c.km!)

/** Km de competencias de running y pista que suman a la semana. */
export const kmDeCompetencias = (comps: CompetenciaHecha[], sesiones: { fecha: string; distancia_km: number | null }[]) =>
  comps.filter((c) => (c.disciplina === 'running' || c.disciplina === 'pista') && !yaRegistrada(c, sesiones)).reduce((t, c) => t + (c.km ?? 0), 0)

export function useCompetenciasHechas(alumnoId: string, desde: string, hasta: string) {
  const [lista, setLista] = useState<CompetenciaHecha[]>([])
  useEffect(() => {
    let vigente = true
    cargarCompetenciasHechas(alumnoId, desde, hasta).then((l) => vigente && setLista(l))
    return () => {
      vigente = false
    }
  }, [alumnoId, desde, hasta])
  return lista
}
