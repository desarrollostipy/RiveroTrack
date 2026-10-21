// Lee el resumen de una actividad PÚBLICA de Garmin Connect a partir del
// link (o del mensaje completo que comparte la app de Garmin).
// Detalle de cómo y por qué: netlify/garmin.ts.

import { createClient } from '@supabase/supabase-js'
import { idActividad, leerActividadGarmin } from '../garmin.ts'

export const config = { path: '/api/leer-garmin' }

const respuesta = (cuerpo: object, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const NO_SE_PUDO =
  'No se pudo leer esta actividad. Revisá que sea pública (en Garmin Connect: la actividad → ⚙ → Privacidad → Todos). Igual podés cargar los datos a mano: el link queda guardado.'

export default async (req: Request) => {
  if (req.method !== 'POST') return respuesta({ error: 'Método no permitido' }, 405)

  // Solo usuarios con sesión (evita que la función se use como proxy abierto).
  const url = process.env.VITE_SUPABASE_URL
  const secreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreta) return respuesta({ error: 'Falta configurar Supabase en Netlify.' }, 500)
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const db = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data } = token ? await db.auth.getUser(token) : { data: { user: null } }
  if (!data.user) return respuesta({ error: 'Iniciá sesión de nuevo.' }, 401)

  const { url: texto } = await req.json().catch(() => ({ url: '' }))
  const id = idActividad(String(texto ?? ''))
  if (!id) return respuesta({ error: 'No encontré un link de actividad de Garmin Connect (…/activity/123456789).' }, 400)

  try {
    const a = await leerActividadGarmin(id)
    if (!a) return respuesta({ error: NO_SE_PUDO, link: `https://connect.garmin.com/modern/activity/${id}` }, 422)
    return respuesta({
      link: `https://connect.garmin.com/modern/activity/${id}`,
      titulo: a.titulo,
      desnivel_m: a.desnivel_m,
      distancia_km: a.distancia_km,
      duracion_seg: a.duracion_seg,
      ritmo_prom_seg: a.ritmo_prom_seg,
      fc_prom: null,
      fc_max: null,
      splits: [],
      datos_crudos: { fuente: 'garmin-resumen-publico', ...a, leido_at: new Date().toISOString() },
    })
  } catch {
    return respuesta({ error: NO_SE_PUDO, link: `https://connect.garmin.com/modern/activity/${id}` }, 422)
  }
}
