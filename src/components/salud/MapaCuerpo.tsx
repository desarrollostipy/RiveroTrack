import type { Molestia, ZonaCuerpo } from '../../lib/salud'
import { ZONAS, LADOS } from '../../lib/salud'

type Lado = 'izq' | 'der' | null
type Parte = { zona: ZonaCuerpo; lado: Lado; forma: 'rect' | 'elipse'; x: number; y: number; w: number; h: number }

// Frente (centro x = 75): la derecha de la persona queda a la izquierda de quien mira.
// Espalda (centro x = 225): la derecha de la persona queda a la derecha.
const PARTES: Parte[] = [
  // Frente
  { zona: 'cuello', lado: null, forma: 'rect', x: 68, y: 40, w: 14, h: 11 },
  { zona: 'hombro', lado: 'der', forma: 'elipse', x: 47, y: 60, w: 13, h: 9 },
  { zona: 'hombro', lado: 'izq', forma: 'elipse', x: 103, y: 60, w: 13, h: 9 },
  { zona: 'cadera', lado: 'der', forma: 'elipse', x: 57, y: 128, w: 8, h: 10 },
  { zona: 'cadera', lado: 'izq', forma: 'elipse', x: 93, y: 128, w: 8, h: 10 },
  { zona: 'ingle', lado: 'der', forma: 'elipse', x: 68, y: 140, w: 6, h: 6 },
  { zona: 'ingle', lado: 'izq', forma: 'elipse', x: 82, y: 140, w: 6, h: 6 },
  { zona: 'cuadriceps', lado: 'der', forma: 'rect', x: 55, y: 148, w: 18, h: 50 },
  { zona: 'cuadriceps', lado: 'izq', forma: 'rect', x: 77, y: 148, w: 18, h: 50 },
  { zona: 'rodilla', lado: 'der', forma: 'elipse', x: 64, y: 207, w: 8, h: 8 },
  { zona: 'rodilla', lado: 'izq', forma: 'elipse', x: 86, y: 207, w: 8, h: 8 },
  { zona: 'tibia', lado: 'der', forma: 'rect', x: 59, y: 217, w: 10, h: 48 },
  { zona: 'tibia', lado: 'izq', forma: 'rect', x: 81, y: 217, w: 10, h: 48 },
  { zona: 'tobillo', lado: 'der', forma: 'elipse', x: 64, y: 271, w: 6, h: 5 },
  { zona: 'tobillo', lado: 'izq', forma: 'elipse', x: 86, y: 271, w: 6, h: 5 },
  { zona: 'pie', lado: 'der', forma: 'elipse', x: 61, y: 284, w: 10, h: 6 },
  { zona: 'pie', lado: 'izq', forma: 'elipse', x: 89, y: 284, w: 10, h: 6 },
  // Espalda
  { zona: 'cuello', lado: null, forma: 'rect', x: 218, y: 40, w: 14, h: 11 },
  { zona: 'espalda_alta', lado: null, forma: 'rect', x: 205, y: 54, w: 40, h: 34 },
  { zona: 'lumbar', lado: null, forma: 'rect', x: 207, y: 92, w: 36, h: 26 },
  { zona: 'gluteo', lado: 'izq', forma: 'elipse', x: 214, y: 134, w: 11, h: 12 },
  { zona: 'gluteo', lado: 'der', forma: 'elipse', x: 236, y: 134, w: 11, h: 12 },
  { zona: 'isquiotibiales', lado: 'izq', forma: 'rect', x: 205, y: 150, w: 18, h: 50 },
  { zona: 'isquiotibiales', lado: 'der', forma: 'rect', x: 227, y: 150, w: 18, h: 50 },
  { zona: 'gemelo', lado: 'izq', forma: 'elipse', x: 214, y: 229, w: 7, h: 20 },
  { zona: 'gemelo', lado: 'der', forma: 'elipse', x: 236, y: 229, w: 7, h: 20 },
  { zona: 'aquiles', lado: 'izq', forma: 'rect', x: 211, y: 252, w: 6, h: 18 },
  { zona: 'aquiles', lado: 'der', forma: 'rect', x: 233, y: 252, w: 6, h: 18 },
]

/** Silueta de fondo (cabeza, torso y brazos), solo de adorno. */
function Silueta({ cx }: { cx: number }) {
  return (
    <g fill="var(--color-borde)" opacity="0.45">
      <circle cx={cx} cy={24} r={16} />
      <rect x={cx - 21} y={50} width={42} height={92} rx={12} />
      <rect x={cx - 38} y={56} width={13} height={78} rx={6} transform={`rotate(8 ${cx - 31} 56)`} />
      <rect x={cx + 25} y={56} width={13} height={78} rx={6} transform={`rotate(-8 ${cx + 31} 56)`} />
      <rect x={cx - 21} y={145} width={19} height={130} rx={8} />
      <rect x={cx + 2} y={145} width={19} height={130} rx={8} />
    </g>
  )
}

/**
 * Mapa del cuerpo (frente y espalda). Las zonas con molestias activas se pintan
 * según la intensidad. Si hay `onElegir`, se puede tocar una zona para marcarla.
 */
export function MapaCuerpo({
  molestias = [],
  elegida,
  onElegir,
}: {
  molestias?: Molestia[]
  elegida?: { zona: ZonaCuerpo; lado: Lado } | null
  onElegir?: (zona: ZonaCuerpo, lado: Lado) => void
}) {
  const intensidad = (p: Parte) =>
    Math.max(0, ...molestias.filter((m) => m.zona === p.zona && (p.lado === null || !m.lado || m.lado === 'ambos' || m.lado === p.lado)).map((m) => m.intensidad))

  return (
    <svg viewBox="0 0 300 310" className="mx-auto w-full max-w-sm" role="group" aria-label="Mapa del cuerpo: frente y espalda">
      <Silueta cx={75} />
      <Silueta cx={225} />
      {PARTES.map((p, i) => {
        const nivel = intensidad(p)
        const sel = elegida && elegida.zona === p.zona && (elegida.lado ?? null) === p.lado
        const relleno = sel ? 'var(--color-azul)' : nivel ? 'var(--color-mal)' : 'var(--color-azul)'
        const opacidad = sel ? 1 : nivel ? 0.35 + (nivel / 10) * 0.65 : 0.16
        const etiqueta = `${ZONAS[p.zona]}${p.lado ? ` ${LADOS[p.lado]}` : ''}${nivel ? `, molestia ${nivel} de 10` : ''}`
        const props = {
          fill: relleno,
          opacity: opacidad,
          stroke: sel ? 'var(--color-azul)' : 'var(--color-superficie)',
          strokeWidth: 1.5,
          className: onElegir ? 'cursor-pointer transition-opacity hover:opacity-70' : undefined,
          onClick: onElegir ? () => onElegir(p.zona, p.lado) : undefined,
          role: onElegir ? 'button' : 'img',
          'aria-label': etiqueta,
          tabIndex: onElegir ? 0 : undefined,
          onKeyDown: onElegir ? (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && onElegir(p.zona, p.lado) : undefined,
        }
        return p.forma === 'rect' ? (
          <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={5} {...props}>
            <title>{etiqueta}</title>
          </rect>
        ) : (
          <ellipse key={i} cx={p.x} cy={p.y} rx={p.w} ry={p.h} {...props}>
            <title>{etiqueta}</title>
          </ellipse>
        )
      })}
      <text x={75} y={306} textAnchor="middle" fontSize="12" fill="var(--color-texto-2)">Frente</text>
      <text x={225} y={306} textAnchor="middle" fontSize="12" fill="var(--color-texto-2)">Espalda</text>
      <text x={20} y={20} fontSize="10" fill="var(--color-texto-2)">Der.</text>
      <text x={130} y={20} fontSize="10" textAnchor="end" fill="var(--color-texto-2)">Izq.</text>
      <text x={170} y={20} fontSize="10" fill="var(--color-texto-2)">Izq.</text>
      <text x={280} y={20} fontSize="10" textAnchor="end" fill="var(--color-texto-2)">Der.</text>
    </svg>
  )
}
