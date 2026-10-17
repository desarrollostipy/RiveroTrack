import { supabase } from './supabase'

type Accion =
  | { accion: 'crear-entrenador'; codigo: string; ci: string; nombre: string; pin: string }
  | { accion: 'crear-acceso'; alumno_id: string; ci: string }
  | { accion: 'resetear-pin'; alumno_id: string }

// Llama a la función de Netlify gestionar-acceso con la sesión actual.
export async function gestionarAcceso<T = { ok: true }>(
  pedido: Accion,
): Promise<{ datos: T; error: null } | { datos: null; error: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  try {
    const res = await fetch('/api/gestionar-acceso', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(pedido),
    })
    const cuerpo = await res.json().catch(() => ({}))
    if (!res.ok) return { datos: null, error: cuerpo.error ?? 'No se pudo completar la operación.' }
    return { datos: cuerpo as T, error: null }
  } catch {
    return { datos: null, error: 'Sin conexión con el servidor.' }
  }
}
