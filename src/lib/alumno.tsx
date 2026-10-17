import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSesion } from './sesion'
import type { Alumno } from './tipos'
import { Cargando } from '../components/ui'

// La ficha del alumno que inició sesión.
const Contexto = createContext<{ alumno: Alumno; recargar: () => Promise<void> } | null>(null)

export function MiAlumnoProvider({ children }: { children: ReactNode }) {
  const { perfil } = useSesion()
  const [alumno, setAlumno] = useState<Alumno | null | undefined>(undefined)

  const recargar = useCallback(async () => {
    const { data } = await supabase.from('alumnos').select('*').eq('profile_id', perfil!.id).maybeSingle()
    setAlumno(data as Alumno | null)
  }, [perfil])

  useEffect(() => {
    recargar()
  }, [recargar])

  if (alumno === undefined) return <Cargando pantalla />
  if (alumno === null)
    return <p className="p-6 text-center text-texto-2">Tu usuario no está vinculado a una ficha de alumno. Avisale a tu entrenador.</p>
  return <Contexto.Provider value={{ alumno, recargar }}>{children}</Contexto.Provider>
}

export function useMiAlumno() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useMiAlumno fuera de MiAlumnoProvider')
  return ctx
}
