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
      <header className="sticky top-0 z-10 -mx-4 bg-fondo/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur">
        {volver && (
          <button
            type="button"
            onClick={irAtras}
            className="-ml-2 mb-1 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-semibold text-azul hover:bg-azul/10"
          >
            <span aria-hidden="true">←</span> Volver
          </button>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-titulo text-2xl font-extrabold">{titulo}</h1>
            {subtitulo && <p className="text-sm text-texto-2">{subtitulo}</p>}
          </div>
          {derecha}
        </div>
      </header>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}
