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
  primario: 'boton-accion',
  oscuro: 'bg-marino text-white hover:bg-marino/90',
  borde: 'border border-borde bg-superficie text-tinta hover:border-azul/50',
  peligro: 'border border-mal/30 bg-superficie text-mal hover:bg-mal/5',
  texto: 'text-azul hover:bg-azul/10',
}

/** Número que sube animado hasta su valor (km, kcal…). */
export function Numero({ valor, decimales = 0, duracion = 900 }: { valor: number; decimales?: number; duracion?: number }) {
  const [v, setV] = useState(valor)
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !valor) {
      setV(valor)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const paso = (t: number) => {
      const k = Math.min(1, (t - t0) / duracion)
      setV(valor * (1 - Math.pow(1 - k, 3)))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, duracion])
  return <>{v.toLocaleString('es-PY', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}</>
}

/** Anillo de progreso que se llena al aparecer. */
export function Anillo({
  pct,
  tam = 84,
  grosor = 9,
  color = 'var(--color-volt)',
  fondo = 'rgba(255,255,255,0.14)',
  children,
}: {
  pct: number
  tam?: number
  grosor?: number
  color?: string
  fondo?: string
  children?: ReactNode
}) {
  const r = (tam - grosor) / 2
  const c = 2 * Math.PI * r
  const [lleno, setLleno] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setLleno(Math.max(0, Math.min(1, pct))))
    return () => cancelAnimationFrame(id)
  }, [pct])
  return (
    <div className="relative shrink-0" style={{ width: tam, height: tam }}>
      <svg width={tam} height={tam} className="-rotate-90" aria-hidden="true">
        <circle cx={tam / 2} cy={tam / 2} r={r} fill="none" stroke={fondo} strokeWidth={grosor} />
        <circle
          cx={tam / 2}
          cy={tam / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - lleno)}
          style={{ transition: 'stroke-dashoffset 1.1s cubic-bezier(.2,.8,.2,1)', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">{children}</div>
    </div>
  )
}

/** Lluvia de confeti para festejar (no hace nada si el celular pide reducir movimiento). */
export function lanzarConfeti(cantidad = 70) {
  if (typeof document === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const colores = ['#C8FF3D', '#5B8BFF', '#FF6B6B', '#F2B544', '#F0A6DB', '#FFFFFF']
  for (let i = 0; i < cantidad; i++) {
    const p = document.createElement('span')
    p.className = 'confeti'
    p.style.left = `${Math.random() * 100}vw`
    p.style.background = colores[i % colores.length]
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 200}px`)
    p.style.setProperty('--r', `${360 + Math.random() * 720}deg`)
    p.style.setProperty('--dur', `${1.8 + Math.random() * 1.6}s`)
    p.style.animationDelay = `${Math.random() * 0.4}s`
    document.body.appendChild(p)
    setTimeout(() => p.remove(), 4200)
  }
  navigator.vibrate?.([30, 40, 30])
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
      className={`min-h-11 rounded-2xl px-4 font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${ESTILOS[variante]} ${className}`}
      {...props}
    />
  )
}

const ESTILO_CAMPO = 'min-h-11 w-full rounded-xl border border-borde bg-superficie px-3 text-base'

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
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                activo ? `border-transparent ${o.color ? 'text-white' : 'boton-accion'}` : 'border-borde bg-superficie text-tinta hover:border-azul/50'
              }`}
              style={activo && o.color ? { background: o.color } : undefined}
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
  return <div className={`rounded-3xl border border-borde bg-superficie p-4 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.6)] ${className}`} {...props} />
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="font-titulo text-lg font-extrabold tracking-tight">{children}</h2>
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
  parcial: { texto: 'Parcial', clase: 'bg-parcial text-[#0B1B3A]' },
  no_cumplio: { texto: 'No cumplió', clase: 'bg-mal text-white' },
} as const

export function Semaforo({ resultado }: { resultado: keyof typeof SEMAFORO }) {
  const s = SEMAFORO[resultado]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s.clase}`}>● {s.texto}</span>
}

export function Indicador({ valor, texto, tono = 'normal' }: { valor: ReactNode; texto: string; tono?: 'normal' | 'ok' | 'mal' | 'azul' }) {
  const color = { normal: 'text-tinta', ok: 'text-ok', mal: 'text-mal', azul: 'text-azul' }[tono]
  return (
    <div className="rounded-3xl border border-borde bg-superficie p-3">
      <p className={`font-titulo text-3xl font-extrabold tracking-tight ${color}`}>{typeof valor === 'number' ? <Numero valor={valor} /> : valor}</p>
      <p className="text-xs text-texto-2">{texto}</p>
    </div>
  )
}

/** Pestañas internas de una pantalla. */
export function Pestanas<T extends string>({ opciones, valor, onChange }: { opciones: { valor: T; texto: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex rounded-2xl border border-borde bg-superficie p-1">
      {opciones.map((o) => (
        <button
          key={o.valor}
          role="tab"
          type="button"
          aria-selected={o.valor === valor}
          onClick={() => onChange(o.valor)}
          className={`min-h-11 min-w-0 flex-1 whitespace-nowrap rounded-xl px-1 text-[0.8rem] font-semibold tracking-tight ${o.valor === valor ? 'bg-tinta text-fondo shadow-sm' : 'text-texto-2'}`}
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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/55 backdrop-blur-sm" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90dvh] w-full max-w-xl animate-entrar overflow-y-auto rounded-t-[2rem] border-t border-borde bg-fondo px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-2"
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-texto-2/40" aria-hidden="true" />
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
    <div className="flex items-center justify-between rounded-2xl border border-borde bg-superficie">
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
      <span className={`inline-flex flex-col items-center justify-center font-titulo font-extrabold leading-none text-tinta ${className}`}>
        <span>RIVERO</span>
        <span className="text-[0.55em] tracking-wide text-azul">TRACK &amp; FIELD</span>
      </span>
    )
  }
  // Dos versiones: la común para modo día y una clara para modo noche (ver index.css).
  return (
    <>
      <img src="/logo-rivero.png" alt="Rivero Track & Field" className={`logo-claro object-contain ${className}`} onError={() => setFalla(true)} />
      <img src="/logo-rivero-oscuro.png" alt="Rivero Track & Field" className={`logo-oscuro object-contain ${className}`} />
    </>
  )
}

/** Foto de perfil redonda; sin foto, las iniciales. */
export function Avatar({ url, nombre, tam = 44, className = '' }: { url?: string | null; nombre: string; tam?: number; className?: string }) {
  const iniciales = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
  return url ? (
    <img src={url} alt="" width={tam} height={tam} className={`shrink-0 rounded-full object-cover ${className}`} style={{ width: tam, height: tam }} />
  ) : (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-azul font-titulo font-extrabold text-white ${className}`}
      style={{ width: tam, height: tam, fontSize: tam * 0.38 }}
    >
      {iniciales}
    </span>
  )
}

/** El estado se muestra durante 24 horas, como las notas de Instagram. */
export function estadoVigente(p: { estado_at?: string | null; estado_emoji?: string | null; estado_texto?: string | null; estado_cancion?: string | null }) {
  if (!p.estado_at) return null
  if (Date.now() - new Date(p.estado_at).getTime() > 24 * 3600 * 1000) return null
  if (!p.estado_emoji && !p.estado_texto && !p.estado_cancion) return null
  return { emoji: p.estado_emoji, texto: p.estado_texto, cancion: p.estado_cancion }
}

/** Globito con el estado, arriba de la foto. */
export function GloboEstado({ estado, className = '' }: { estado: ReturnType<typeof estadoVigente>; className?: string }) {
  if (!estado) return null
  return (
    <span className={`inline-flex max-w-[11rem] flex-col rounded-2xl border border-borde bg-superficie px-2.5 py-1 text-left text-xs leading-tight text-tinta shadow-sm ${className}`}>
      {(estado.emoji || estado.texto) && (
        <span className="truncate">
          {estado.emoji} {estado.texto}
        </span>
      )}
      {estado.cancion && <span className="truncate text-texto-2">🎵 {estado.cancion}</span>}
    </span>
  )
}

export function Cargando({ pantalla = false }: { pantalla?: boolean }) {
  // Pantalla completa: el logo late y una luz verde recorre la barra.
  if (pantalla)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6" role="status">
        <Logo className="splash-logo h-24 w-56" />
        <div className="splash-barra h-1 w-40 rounded-full bg-borde" aria-hidden="true" />
        <span className="sr-only">Cargando…</span>
      </div>
    )
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-texto-2" role="status">
      <span className="h-2 w-2 animate-bounce rounded-full bg-volt [animation-delay:-0.2s]" aria-hidden="true" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-azul [animation-delay:-0.1s]" aria-hidden="true" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-volt" aria-hidden="true" />
      <span className="sr-only">Cargando…</span>
    </div>
  )
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-borde px-4 py-6 text-center text-texto-2">{children}</p>
}
