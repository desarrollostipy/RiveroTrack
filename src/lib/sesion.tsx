import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { emailDesdeCi } from './acceso'

export type Perfil = {
  id: string
  ci: string
  rol: 'entrenador' | 'alumno'
  nombre: string
  debe_cambiar_clave: boolean
  avatar_url: string | null
  estado_emoji: string | null
  estado_texto: string | null
  estado_cancion: string | null
  estado_at: string | null
}

type ContextoSesion = {
  cargando: boolean
  session: Session | null
  perfil: Perfil | null
  ingresar: (ci: string, pin: string) => Promise<string | null>
  salir: () => Promise<void>
  recargarPerfil: () => Promise<void>
}

const Contexto = createContext<ContextoSesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  // undefined = todavía no sabemos si hay sesión
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [perfilDe, setPerfilDe] = useState<{ userId: string; perfil: Perfil | null } | null>(null)

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id

  const cargarPerfil = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    setPerfilDe({ userId: id, perfil: data as Perfil | null })
  }, [])

  useEffect(() => {
    if (userId) cargarPerfil(userId)
  }, [userId, cargarPerfil])

  const ingresar = useCallback(async (ci: string, pin: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: emailDesdeCi(ci), password: pin })
    if (!error) return null
    if (error.message.includes('Invalid login')) return 'CI o PIN incorrectos.'
    return 'No se pudo ingresar. Revisá tu conexión e intentá de nuevo.'
  }, [])

  const salir = useCallback(async () => {
    await supabase.auth.signOut()
    setPerfilDe(null)
  }, [])

  const recargarPerfil = useCallback(async () => {
    if (userId) await cargarPerfil(userId)
  }, [userId, cargarPerfil])

  const cargando = session === undefined || (!!userId && perfilDe?.userId !== userId)

  return (
    <Contexto.Provider
      value={{
        cargando,
        session: session ?? null,
        perfil: perfilDe && perfilDe.userId === userId ? perfilDe.perfil : null,
        ingresar,
        salir,
        recargarPerfil,
      }}
    >
      {children}
    </Contexto.Provider>
  )
}

export function useSesion() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useSesion fuera de SesionProvider')
  return ctx
}
