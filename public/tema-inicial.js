// Aplica el modo día / noche antes de dibujar la página (evita un parpadeo).
// Va en un archivo aparte (y no dentro de index.html) para cumplir la política de seguridad.
try {
  var t = localStorage.getItem('rivero-tema')
  var o = t === 'oscuro' || (t !== 'claro' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = o ? 'oscuro' : 'claro'
} catch (e) {}
