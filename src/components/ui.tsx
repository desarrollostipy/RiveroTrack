import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

type Variante = 'primario' | 'oscuro' | 'borde' | 'peligro' | 'texto'

const ESTILOS: Record<Variante, string> = {
  primario: 'bg-azul text-white hover:bg-azul-hover',
  oscuro: 'bg-marino text-white hover:bg-marino/90',
  borde: 'border border-borde bg-white text-marino hover:bg-fondo',
  peligro: 'border border-mal/30 bg-white text-mal hover:bg-mal/5',
  texto: 'text-azul hover:bg-azul/10',
}

export function Boton({
  variante = 'primario',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      type={type}
      className={`min-h-11 rounded-xl px-4 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  )
}

const ESTILO_CAMPO = 'min-h-11 w-full rounded-xl border border-borde bg-white px-3 text-base'

function Envoltura({ label, id, ayuda, className = '', children }: { label: string; id: string; ayuda?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {ayuda && (
        <p id={`${id}-ayuda`} className="text-sm text-texto-2">
          {ayuda}
        </p>
      )}
    </div>
  )
}

type ConLabel = { label: string; id: string; ayuda?: string }

export function Campo({ label, id, ayuda, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & ConLabel) {
  return (
    <Envoltura label={label} id={id} ayuda={ayuda} className={className}>
      <input id={id} className={ESTILO_CAMPO} aria-describedby={ayuda ? `${id}-ayuda` : undefined} {...props} />
    </Envoltura>
  )
}

export function AreaTexto({ label, id, ayuda, className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & ConLabel) {
  return (
    <Envoltura label={label} id={id} ayuda={ayuda} className={className}>
      <textarea id={id} rows={3} className={`${ESTILO_CAMPO} py-2`} {...props} />
    </Envoltura>
  )
}

export function Selector({ label, id, ayuda, className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & ConLabel) {
  return (
    <Envoltura label={label} id={id} ayuda={ayuda} className={className}>
      <select id={id} className={ESTILO_CAMPO} {...props}>
        {children}
      </select>
    </Envoltura>
  )
}

/** Botones de opción excluyentes (chips). */
export function Opciones<T extends string | number>({
  label,
  opciones,
  valor,
  onChange,
  className = '',
}: {
  label: string
  opciones: { valor: T; texto: string; color?: string }[]
  valor: T | null
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <fieldset className={className}>
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = o.valor === valor
          return (
            <button
              key={String(o.valor)}
              type="button"
              aria-pressed={activo}
              onClick={() => onChange(o.valor)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                activo ? 'border-transparent text-white' : 'border-borde bg-white text-marino hover:bg-fondo'
              }`}
              style={activo ? { background: o.color ?? 'var(--color-azul)' } : undefined}
            >
              {o.texto}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function Tarjeta({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-borde bg-white p-4 ${className}`} {...props} />
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="font-titulo text-lg font-extrabold">{children}</h2>
      {accion}
    </div>
  )
}

export function MensajeError({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="alert" className="rounded-xl bg-mal/10 px-3 py-2 text-sm font-medium text-mal">
      {children}
    </p>
  )
}

export function MensajeOk({ children }: { children?: ReactNode }) {
  if (!children) return null
  return (
    <p role="status" className="rounded-xl bg-ok/10 px-3 py-2 text-sm font-medium text-ok">
      {children}
    </p>
  )
}

/** Tipo de sesión con su color. */
export function EtiquetaTipo({ nombre, color }: { nombre: string; color: string }) {
  return (
    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold text-white" style={{ background: color }}>
      {nombre}
    </span>
  )
}

const SEMAFORO = {
  cumplio: { texto: 'Cumplió', clase: 'bg-ok text-white' },
  parcial: { texto: 'Parcial', clase: 'bg-parcial text-marino' },
  no_cumplio: { texto: 'No cumplió', clase: 'bg-mal text-white' },
} as const

export function Semaforo({ resultado }: { resultado: keyof typeof SEMAFORO }) {
  const s = SEMAFORO[resultado]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s.clase}`}>● {s.texto}</span>
}

export function Indicador({ valor, texto, tono = 'normal' }: { valor: ReactNode; texto: string; tono?: 'normal' | 'ok' | 'mal' | 'azul' }) {
  const color = { normal: 'text-marino', ok: 'text-ok', mal: 'text-mal', azul: 'text-azul' }[tono]
  return (
    <div className="rounded-2xl border border-borde bg-white p-3">
      <p className={`font-titulo text-2xl font-extrabold ${color}`}>{valor}</p>
      <p className="text-xs text-texto-2">{texto}</p>
    </div>
  )
}

/** Pestañas internas de una pantalla. */
export function Pestanas<T extends string>({ opciones, valor, onChange }: { opciones: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex rounded-xl bg-borde/60 p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          type="button"
          aria-selected={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={`min-h-11 flex-1 rounded-lg text-sm font-semibold ${o.valor === valor ? 'bg-white text-azul shadow-sm' : 'text-texto-2'}`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}

/** Panel inferior (formulario sobre la pantalla). */
export function Hoja({ titulo, abierta, onCerrar, children }: { titulo: string; abierta: boolean; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!abierta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', esc)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', esc)
      document.body.style.overflow = ''
    }
  }, [abierta, onCerrar])
  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-marino/50" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-fondo px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-titulo text-xl font-extrabold">{titulo}</h2>
          <Boton variante="texto" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </Boton>
        </div>
        <div className="flex flex-col gap-3">{children}</div>
      </div>
    </div>
  )
}

/** Selector ‹ semana › */
export function SelectorPeriodo({ texto, onAnterior, onSiguiente, detalle }: { texto: string; onAnterior: () => void; onSiguiente: () => void; detalle?: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-borde bg-white">
      <button type="button" onClick={onAnterior} aria-label="Anterior" className="min-h-11 min-w-11 rounded-l-2xl text-xl font-bold text-azul hover:bg-fondo">
        ‹
      </button>
      <div className="text-center">
        <p className="font-semibold">{texto}</p>
        {detalle && <div className="text-xs text-texto-2">{detalle}</div>}
      </div>
      <button type="button" onClick={onSiguiente} aria-label="Siguiente" className="min-h-11 min-w-11 rounded-r-2xl text-xl font-bold text-azul hover:bg-fondo">
        ›
      </button>
    </div>
  )
}

// Si no está el archivo del logo, muestra el nombre en texto.
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
  return <img src="/logo-rivero.png" alt="Rivero Track & Field" className={`object-contain ${className}`} onError={() => setFalla(true)} />
}

export function Cargando({ pantalla = false }: { pantalla?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-texto-2 ${pantalla ? 'min-h-dvh' : 'py-10'}`} role="status">
      Cargando…
    </div>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-borde px-4 py-6 text-center text-texto-2">{children}</p>
}
