import { Component, type ReactNode } from 'react'
import { Logo } from './ui'

/** Si algo falla al mostrar una pantalla, en vez de quedar en blanco se ofrece recargar. */
export class ErrorPantalla extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false }

  static getDerivedStateFromError() {
    return { error: true }
  }

  componentDidCatch(e: unknown) {
    console.error(e)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <Logo className="w-40" />
        <h1 className="font-titulo text-xl font-extrabold text-tinta">Se cortó la carga</h1>
        <p className="text-texto-2">Puede ser la conexión o que hay una versión nueva de la app. Tocá para recargar.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 w-full rounded-xl bg-azul px-4 font-semibold text-white"
        >
          🔄 Recargar
        </button>
      </main>
    )
  }
}
