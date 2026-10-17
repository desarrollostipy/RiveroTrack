// Carga o borra los alumnos de prueba desde la app (sin terminal).
// Solo el entrenador. Se carga un alumno por llamada para no pasar
// el tiempo máximo de las funciones de Netlify.

import { createClient } from '@supabase/supabase-js'
import { cargarAlumnoPrueba, entrenadorId, limpiarDatosPrueba } from '../../scripts/datos-prueba.ts'

export const config = { path: '/api/datos-prueba' }

const respuesta = (cuerpo: object, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

export default async (req: Request) => {
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405)
  const url = process.env.VITE_SUPABASE_URL
  const secreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreta) return respuesta({ error: 'Falta configurar SUPABASE_SECRET_KEY en Netlify.' }, 500)
  const db = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })

  // Verificar que quien llama es el entrenador.
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { data: usuario } = token ? await db.auth.getUser(token) : { data: { user: null } }
  if (!usuario.user) return respuesta({ error: 'Iniciá sesión de nuevo.' }, 401)
  const { data: perfil } = await db.from('profiles').select('rol').eq('id', usuario.user.id).maybeSingle()
  if (perfil?.rol !== 'entrenador') return respuesta({ error: 'Solo el entrenador puede hacer esto.' }, 403)

  try {
    const pedido = await req.json()
    if (pedido.accion === 'cargar') {
      const nombre = await cargarAlumnoPrueba(db, Number(pedido.indice), await entrenadorId(db))
      return respuesta({ ok: true, nombre })
    }
    if (pedido.accion === 'limpiar') return respuesta({ ok: true, ...(await limpiarDatosPrueba(db)) })
    return respuesta({ error: 'Acción desconocida.' }, 400)
  } catch (e) {
    return respuesta({ error: (e as Error).message || 'Error al cargar los datos de prueba.' }, 500)
  }
}
