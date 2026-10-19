// Modo día / noche. La preferencia se guarda en este celular.
// 'auto' sigue la configuración del teléfono.

export type PreferenciaTema = 'auto' | 'claro' | 'oscuro'
const CLAVE = 'rivero-tema'

export function preferenciaTema(): PreferenciaTema {
  try {
    const v = localStorage.getItem(CLAVE)
    return v === 'claro' || v === 'oscuro' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

const sistemaOscuro = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

export function aplicarTema(pref: PreferenciaTema = preferenciaTema()) {
  const oscuro = pref === 'oscuro' || (pref === 'auto' && sistemaOscuro())
  document.documentElement.dataset.theme = oscuro ? 'oscuro' : 'claro'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', oscuro ? '#0A1428' : '#0B1B3A')
}

export function guardarTema(pref: PreferenciaTema) {
  try {
    if (pref === 'auto') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, pref)
  } catch {
    // sin almacenamiento: se aplica igual, pero no se recuerda
  }
  aplicarTema(pref)
}

// Si está en automático y el teléfono cambia de modo, la app acompaña.
export function seguirSistema() {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (preferenciaTema() === 'auto') aplicarTema('auto')
  })
}
