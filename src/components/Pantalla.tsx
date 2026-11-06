import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'

type Props = {
  titulo: ReactNode
  subtitulo?: ReactNode
  /** Ruta a la que vuelve si no hay historial. Si se indica, aparece "Volver". */
  volver?: string
  derecha?: ReactNode
  children?: ReactNode
}

export function Pantalla({ titulo, subtitulo, volver, derecha, children }: Props) {
  const navigate = useNavigate()

  const irAtras = () => {
    if (window.history.state?.idx > 0) navigate(-1)
    else navigate(volver!, { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-6">
      <header className="sticky top-0 z-10 -mx-4 bg-fondo/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl">
        {volver && (
          <button
            type="button"
            onClick={irAtras}
            className="-ml-1 mb-1 inline-flex min-h-10 items-center gap-1 rounded-full border border-borde bg-superficie px-3 text-sm font-semibold text-tinta hover:border-azul/50"
          >
            <span aria-hidden="true">←</span> Volver
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {subtitulo && <p className="text-xs font-semibold uppercase tracking-wider text-texto-2">{subtitulo}</p>}
            <h1 className="font-titulo text-3xl font-black leading-tight tracking-tight">{titulo}</h1>
          </div>
          {derecha}
        </div>
      </header>
      <div className="pantalla-contenido flex flex-col gap-3">{children}</div>
    </div>
  )
}
