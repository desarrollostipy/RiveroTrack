// Versiones nuevas: cuando se publica en Netlify, cambian los nombres de los
// archivos de cada pantalla. Una app abierta desde antes busca los viejos, que
// ya no existen, y la pantalla quedaba en blanco.
import { lazy, useEffect, useRef, type ComponentType } from 'react'
import { useLocation } from 'react-router'

const CLAVE = 'rivero-recarga'
let versionNueva = false

function recargarUnaVez() {
  let ultima = 0
  try {
    ultima = Number(sessionStorage.getItem(CLAVE)) || 0
  } catch {
    /* sin almacenamiento */
  }
  // Una sola vez cada 30 s, para no entrar en un ciclo si falta internet.
  if (Date.now() - ultima < 30_000) return false
  try {
    sessionStorage.setItem(CLAVE, String(Date.now()))
  } catch {
    /* sin almacenamiento */
  }
  window.location.reload()
  return true
}

/** Como `lazy`, pero si el archivo de la pantalla ya no existe, recarga para traer la versión nueva. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function pantalla<T extends ComponentType<any>>(cargar: () => Promise<{ default: T }>) {
  return lazy(() =>
    cargar().catch((e) => {
      if (recargarUnaVez()) return new Promise<{ default: T }>(() => {})
      throw e
    }),
  )
}

/** Busca versiones nuevas al volver a la app y avisa cuando hay una lista. */
export function vigilarVersion() {
  if (!('serviceWorker' in navigator)) return
  const habia = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (habia) versionNueva = true
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.update())
        .catch(() => {})
  })
}

/** Si hay versión nueva, se aplica al cambiar de pantalla (nunca en medio de lo que se está escribiendo). */
export function useActualizarAlNavegar() {
  const { pathname } = useLocation()
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    if (versionNueva) window.location.reload()
  }, [pathname])
}
