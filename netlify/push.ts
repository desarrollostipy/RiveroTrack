// Envío de notificaciones push (Web Push con claves VAPID).
// Variables en Netlify: VITE_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_CONTACTO.

import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

export type Contenido = { titulo: string; cuerpo: string; url?: string; etiqueta?: string }

export function pushListo() {
  const pub = process.env.VITE_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_CONTACTO || 'mailto:rivero@example.com', pub, priv)
  return true
}

/** Manda la notificación a todos los celulares suscriptos de esas personas. */
export async function enviarA(db: SupabaseClient, profileIds: string[], contenido: Contenido) {
  const ids = [...new Set(profileIds.filter(Boolean))]
  if (!ids.length || !pushListo()) return 0
  const { data } = await db.from('push_suscripciones').select('endpoint, p256dh, auth').in('profile_id', ids)
  let enviadas = 0
  await Promise.all(
    (data ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(contenido), { TTL: 60 * 60 * 24 })
        enviadas++
      } catch (e) {
        // Suscripción vencida o dada de baja: se borra.
        const codigo = (e as { statusCode?: number }).statusCode
        if (codigo === 404 || codigo === 410) await db.from('push_suscripciones').delete().eq('endpoint', s.endpoint)
      }
    }),
  )
  return enviadas
}
