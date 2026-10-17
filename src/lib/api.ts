import { supabase } from './supabase'

type Resultado<T> = { datos: T; error: null } | { datos: null; error: string }

// Llama a una función de Netlify (/api/...) con la sesión actual.
export async function llamarFuncion<T>(ruta: string, pedido: object): Promise<Resultado<T>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  try {
    const res = await fetch(`/api/${ruta}`, {
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

type AccionAcceso =
  | { accion: 'crear-entrenador'; codigo: string; ci: string; nombre: string; pin: string }
  | { accion: 'crear-acceso'; alumno_id: string; ci: string }
  | { accion: 'resetear-pin'; alumno_id: string }

export const gestionarAcceso = <T = { ok: true; pin?: string }>(pedido: AccionAcceso) =>
  llamarFuncion<T>('gestionar-acceso', pedido)
