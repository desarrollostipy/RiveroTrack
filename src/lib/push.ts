import { supabase } from './supabase'
import { llamarFuncion } from './api'

// Notificaciones push: el celular recibe avisos aunque la app esté cerrada.
// En iPhone funcionan solo con la app agregada a la pantalla de inicio (iOS 16.4+).

const CLAVE_PUBLICA = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export const pushConfigurado = () => Boolean(CLAVE_PUBLICA)
export const pushSoportado = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
export const esIphoneSinInstalar = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone)

function claveABytes(base64: string) {
  const relleno = '='.repeat((4 - (base64.length % 4)) % 4)
  const b = atob((base64 + relleno).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(b, (c) => c.charCodeAt(0))
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!pushSoportado()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return (await reg?.pushManager.getSubscription()) ?? null
}

export async function activarPush(): Promise<string | null> {
  if (!pushConfigurado()) return 'Las notificaciones todavía no están configuradas en el servidor.'
  if (!pushSoportado()) return 'Este navegador no permite notificaciones.'
  if (esIphoneSinInstalar()) return 'En iPhone, primero agregá la app a la pantalla de inicio (Compartir → Agregar a inicio) y abrila desde ahí.'
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') return 'No diste permiso. Podés habilitarlo en la configuración del navegador.'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveABytes(CLAVE_PUBLICA!) }))
  const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase
    .from('push_suscripciones')
    .upsert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' })
  return error ? 'No se pudo guardar la suscripción. Intentá de nuevo.' : null
}

export async function desactivarPush() {
  const sub = await suscripcionActual()
  if (!sub) return
  await supabase.from('push_suscripciones').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

type Aviso =
  | { tipo: 'mensaje'; alumno_id: string; texto: string }
  | { tipo: 'plan_publicado'; alumno_ids: string[]; semana: string }
  | { tipo: 'anuncio'; anuncio_id: string }
  | { tipo: 'evaluacion'; sesion_planificada_id: string }
  | { tipo: 'sesion'; sesion_planificada_id: string }
  | { tipo: 'competencia'; competencia_id: string }
  | { tipo: 'evento'; evento_id: string }
  | { tipo: 'comprobante'; comprobante_id: string }
  | { tipo: 'comprobante_revisado'; comprobante_id: string }
  | { tipo: 'masivo'; alumno_ids: string[]; texto: string }
  | { tipo: 'prueba' }

/** Avisa por push (no frena la app si falla o si no está configurado). */
export function notificar(aviso: Aviso) {
  llamarFuncion('notificar', aviso).catch(() => {})
}
