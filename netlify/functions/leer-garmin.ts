// Lee una actividad PÚBLICA de Garmin Connect a partir de su link.
//
// ⚠ Garmin no tiene una API pública para esto: se usan los mismos pedidos
// que hace su página web. Puede no funcionar o dejar de funcionar sin aviso.
// Por eso la carga manual siempre queda disponible.
// Pendiente: prueba técnica con links reales (Etapa 3).

import { createClient } from '@supabase/supabase-js'

export const config = { path: '/api/leer-garmin' }

const respuesta = (cuerpo: object, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const NO_SE_PUDO =
  'No se pudo leer esta actividad de Garmin. Revisá que sea pública (en Garmin Connect: Privacidad → Todos) o cargala a mano en la pestaña Carga manual.'

const BASES = ['https://connect.garmin.com/activity-service/activity', 'https://connect.garmin.com/modern/proxy/activity-service/activity']

const ENCABEZADOS = {
  Accept: 'application/json',
  NK: 'NT',
  'DI-Backend': 'connectapi.garmin.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
}

async function pedirJson(ruta: string) {
  for (const base of BASES) {
    try {
      const r = await fetch(`${base}/${ruta}`, { headers: ENCABEZADOS, signal: AbortSignal.timeout(8000) })
      if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) return await r.json()
    } catch {
      // probar con la siguiente dirección
    }
  }
  return null
}

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

  const { url: link } = await req.json().catch(() => ({ url: '' }))
  const id = String(link ?? '').match(/garmin\.com\/.*activity\/(\d+)/)?.[1]
  if (!id) return respuesta({ error: 'El link no parece de una actividad de Garmin Connect (…/activity/123456789).' }, 400)

  const actividad = await pedirJson(id)
  if (!actividad?.summaryDTO) return respuesta({ error: NO_SE_PUDO }, 422)

  const s = actividad.summaryDTO
  const distanciaKm = Math.round(((s.distance ?? 0) / 1000) * 100) / 100
  const duracion = Math.round(s.movingDuration ?? s.duration ?? s.elapsedDuration ?? 0)
  if (!distanciaKm || !duracion) return respuesta({ error: NO_SE_PUDO }, 422)

  // Splits: las vueltas de Garmin (con autolap, una por km).
  const vueltas = await pedirJson(`${id}/splits`)
  const splits = ((vueltas?.lapDTOs ?? []) as { distance?: number; duration?: number; movingDuration?: number; averageHR?: number }[])
    .filter((l) => (l.distance ?? 0) > 100)
    .map((l, i) => {
      const seg = Math.round(l.movingDuration ?? l.duration ?? 0)
      const km = (l.distance ?? 0) / 1000
      return { km: i + 1, tiempo_seg: seg, ritmo_seg: Math.round(seg / km), fc: l.averageHR ? Math.round(l.averageHR) : null }
    })

  return respuesta({
    distancia_km: distanciaKm,
    duracion_seg: duracion,
    ritmo_prom_seg: Math.round(duracion / distanciaKm),
    fc_prom: s.averageHR ? Math.round(s.averageHR) : null,
    fc_max: s.maxHR ? Math.round(s.maxHR) : null,
    splits,
    datos_crudos: { actividad_id: id, summaryDTO: s, activityName: actividad.activityName ?? null, leido_at: new Date().toISOString() },
  })
}
