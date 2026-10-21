import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPY, sumarDias } from '../lib/fechas'
import { Tarjeta } from './ui'

/** Asistencia a entrenamientos grupales en los últimos 30 días. */
export function AsistenciaMes({ alumnoId }: { alumnoId: string }) {
  const [d, setD] = useState<{ fue: number; total: number } | null>(null)

  useEffect(() => {
    const desde = sumarDias(hoyPY(), -30)
    Promise.all([
      supabase.from('entrenamientos_grupales').select('id, grupo_id').gte('fecha', desde).lte('fecha', hoyPY()),
      supabase.from('asistencias').select('entrenamiento_id').eq('alumno_id', alumnoId),
      supabase.from('alumnos').select('grupo_id').eq('id', alumnoId).maybeSingle(),
    ]).then(([e, a, al]) => {
      const grupo = (al.data as { grupo_id: string | null } | null)?.grupo_id ?? null
      // Cuentan los entrenamientos para todos o para su grupo.
      const suyos = ((e.data ?? []) as { id: string; grupo_id: string | null }[]).filter((x) => !x.grupo_id || x.grupo_id === grupo)
      const ids = new Set(suyos.map((x) => x.id))
      const fue = ((a.data ?? []) as { entrenamiento_id: string }[]).filter((x) => ids.has(x.entrenamiento_id)).length
      setD({ fue, total: suyos.length })
    })
  }, [alumnoId])

  if (!d || d.total === 0) return null
  return (
    <Tarjeta className="flex items-center justify-between gap-2">
      <span>
        <span className="block font-semibold">📍 Entrenamientos grupales</span>
        <span className="text-sm text-texto-2">Últimos 30 días</span>
      </span>
      <span className="font-titulo text-2xl font-extrabold text-azul">
        {d.fue}/{d.total}
      </span>
    </Tarjeta>
  )
}
