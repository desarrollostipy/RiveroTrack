import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Grupo } from './tipos'

export function useGrupos() {
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('grupos').select('id, nombre, color').order('nombre')
    setGrupos((data ?? []) as Grupo[])
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { grupos, recargar: cargar, grupo: (id: string | null | undefined) => grupos.find((g) => g.id === id) ?? null }
}

export const COLORES_GRUPO = ['#1446B8', '#0F6E78', '#6B4E8C', '#2E7D4F', '#B3261E', '#D9A032', '#0B1B3A', '#C2185B']
