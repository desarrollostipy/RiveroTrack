import { useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

type Variante = 'primario' | 'oscuro' | 'borde'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-azul text-white hover:bg-azul-hover',
  oscuro: 'bg-marino text-white hover:bg-marino/90',
  borde: 'border border-borde bg-white text-marino hover:bg-fondo',
}

export function Boton({
  variante = 'primario',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      className={`min-h-11 rounded-xl px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  )
}

export function Campo({
  label,
  id,
  ayuda,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string; ayuda?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        className="min-h-11 rounded-xl border border-borde bg-white px-3 text-base"
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        {...props}
      />
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-sm text-texto-2">
          {ayuda}
        </p>
      )}
    </div>
  )
}

export function Tarjeta({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-borde bg-white p-4 ${className}`} {...props} />
}

export function MensajeError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-mal/10 px-3 py-2 text-sm font-medium text-mal">
      {children}
    </p>
  )
}

// Si todavía no está el archivo del logo, muestra el nombre en texto.
export function Logo({ className = '' }: { className?: string }) {
  const [falla, setFalla] = useState(false)
  if (falla) {
    return (
      <span className={`inline-flex flex-col items-center justify-center font-titulo font-extrabold leading-none text-marino ${className}`}>
        <span>RIVERO</span>
        <span className="text-[0.55em] tracking-wide text-azul">TRACK &amp; FIELD</span>
      </span>
    )
  }
  return (
    <img
      src="/logo-rivero.png"
      alt="Rivero Track & Field"
      className={`object-contain ${className}`}
      onError={() => setFalla(true)}
    />
  )
}

export function EnConstruccion({ etapa, children }: { etapa: number; children: ReactNode }) {
  return (
    <Tarjeta className="border-dashed text-texto-2">
      <p className="text-sm font-semibold text-azul">Etapa {etapa}</p>
      <p className="mt-1">{children}</p>
    </Tarjeta>
  )
}

export function Cargando() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-texto-2" role="status">
      Cargando…
    </div>
  )
}
