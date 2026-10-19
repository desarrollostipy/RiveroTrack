import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export type Mensaje = {
  id: string
  alumno_id: string
  autor_id: string
  texto: string
  created_at: string
  leido_at: string | null
}

const LEIDOS = 'rivero:chat-leido'

/** Avisa a los contadores de la pantalla que se acaban de leer mensajes. */
export function avisarLeidos() {
  window.dispatchEvent(new Event(LEIDOS))
}

/**
 * Mensajes sin leer (escritos por el otro), agrupados por alumno.
 * Se actualiza solo cuando llega o se lee un mensaje.
 */
export function useNoLeidos(miId: string | undefined, alumnoId?: string) {
  const [porAlumno, setPorAlumno] = useState<Record<string, number>>({})

  const contar = useCallback(async () => {
    if (!miId) return
    let q = supabase.from('mensajes').select('alumno_id').is('leido_at', null).neq('autor_id', miId)
    if (alumnoId) q = q.eq('alumno_id', alumnoId)
    const { data } = await q
    const cuenta: Record<string, number> = {}
    for (const m of (data ?? []) as { alumno_id: string }[]) cuenta[m.alumno_id] = (cuenta[m.alumno_id] ?? 0) + 1
    setPorAlumno(cuenta)
  }, [miId, alumnoId])

  useEffect(() => {
    contar()
    const canal = supabase
      // Nombre único: este contador puede estar abierto en varias pantallas a la vez.
      .channel(`no-leidos-${alumnoId ?? 'todos'}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes', ...(alumnoId ? { filter: `alumno_id=eq.${alumnoId}` } : {}) }, () => contar())
      .subscribe()
    // Al volver a la app (por ejemplo, desde otra pestaña del celular).
    const alVolver = () => document.visibilityState === 'visible' && contar()
    document.addEventListener('visibilitychange', alVolver)
    // Al leer un chat en esta misma pantalla, sin esperar al aviso del servidor.
    window.addEventListener(LEIDOS, contar)
    return () => {
      supabase.removeChannel(canal)
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener(LEIDOS, contar)
    }
  }, [contar, alumnoId])

  const total = Object.values(porAlumno).reduce((t, n) => t + n, 0)
  return { porAlumno, total, recontar: contar }
}
