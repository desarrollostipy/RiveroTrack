// Notificaciones push de Rivero Track & Field.
// Lo carga el service worker de la app (ver vite.config.ts → importScripts).

self.addEventListener('push', (evento) => {
  let datos = {}
  try {
    datos = evento.data ? evento.data.json() : {}
  } catch {
    datos = { cuerpo: evento.data ? evento.data.text() : '' }
  }
  const titulo = datos.titulo || 'Rivero Track & Field'
  evento.waitUntil(
    self.registration.showNotification(titulo, {
      body: datos.cuerpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-48.png',
      tag: datos.etiqueta || undefined,
      renotify: Boolean(datos.etiqueta),
      data: { url: datos.url || '/' },
    }),
  )
})

// Al tocar la notificación, abrir (o enfocar) la app en la pantalla indicada.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = new URL(evento.notification.data?.url || '/', self.location.origin).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((ventanas) => {
      for (const v of ventanas) {
        if ('focus' in v) {
          v.navigate?.(url)
          return v.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
