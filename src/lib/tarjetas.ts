// Imágenes para compartir en Instagram / WhatsApp, con la marca Rivero.
// Se dibujan en el celular (canvas) y se comparten como PNG.
// Dos formatos: historia (1080×1920, pantalla completa) o publicación (1080×1350).
// Tres fondos: azul, blanco o sin fondo (para poner sobre una foto).

export type Dato = { etiqueta: string; valor: string }
export type Barra = { etiqueta: string; valor: number; texto?: string; destacada?: boolean }
export type Grafico = { titulo: string; barras?: Barra[]; ritmos?: number[] }
export type Fila = { icono: string; texto: string; valor: string; progreso?: number; cumplido?: boolean }
export type Estilo = 'azul' | 'blanco' | 'transparente'
export type Formato = 'historia' | 'publicacion'
// foto: una foto propia de fondo (no se sube a ningún lado: se dibuja en el celular).
export type Diseno = { fondo: Estilo; formato: Formato; foto?: ImageBitmap | null }

export const ESTILOS: { valor: Estilo; texto: string }[] = [
  { valor: 'azul', texto: '🔵 Azul' },
  { valor: 'blanco', texto: '⚪ Blanco' },
  { valor: 'transparente', texto: '🔲 Sin fondo' },
]

export const FORMATOS: { valor: Formato; texto: string }[] = [
  { valor: 'historia', texto: '📱 Historia' },
  { valor: 'publicacion', texto: '🖼️ Publicación' },
]

const ANCHO = 1080
const ALTO_PUBLICACION = 1350
const ALTO_HISTORIA = 1920
// En historia se deja libre arriba y abajo lo que tapa Instagram (nombre y barra de respuesta).
const BAJADA = 200
const LIBRE_ABAJO = 140
// Alto del contenido de la imagen que se está dibujando (lo fija lienzo()).
let ALTO = ALTO_PUBLICACION
const M = 64 // margen
const MARINO = '#0B1B3A'
const AZUL = '#1446B8'
const CELESTE = '#7EA6FF'
const VERDE = '#3DBE7A'
const EMOJI = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"'
const TITULO = (peso: number, px: number) => `${peso} ${px}px Archivo, ${EMOJI}, sans-serif`
const TEXTO = (peso: number, px: number) => `${peso} ${px}px "IBM Plex Sans", ${EMOJI}, sans-serif`
const MONO = (peso: number, px: number) => `${peso} ${px}px "IBM Plex Mono", ${EMOJI}, monospace`

type Paleta = { texto: string; suave: string; acento: string; acentoSuave: string; panel: string; logo: string; sombra: boolean }
const PALETAS: Record<Estilo, Paleta> = {
  azul: { texto: '#FFFFFF', suave: 'rgba(255,255,255,0.72)', acento: CELESTE, acentoSuave: 'rgba(126,166,255,0.42)', panel: 'rgba(255,255,255,0.08)', logo: '/logo-rivero-oscuro.png', sombra: false },
  blanco: { texto: MARINO, suave: '#5A6784', acento: AZUL, acentoSuave: 'rgba(20,70,184,0.25)', panel: 'rgba(20,70,184,0.07)', logo: '/logo-rivero.png', sombra: false },
  transparente: { texto: '#FFFFFF', suave: 'rgba(255,255,255,0.92)', acento: '#FFFFFF', acentoSuave: 'rgba(255,255,255,0.4)', panel: 'rgba(11,27,58,0.42)', logo: '/logo-rivero-oscuro.png', sombra: true },
}

const logos = new Map<string, Promise<HTMLImageElement | null>>()
function cargarLogo(url: string) {
  if (!logos.has(url))
    logos.set(
      url,
      new Promise((ok) => {
        const img = new Image()
        img.onload = () => ok(img)
        img.onerror = () => ok(null)
        img.src = url
      }),
    )
  return logos.get(url)!
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/** Foto de fondo recortada para llenar la imagen, con sombras arriba y abajo para leer el texto. */
function dibujarFoto(g: CanvasRenderingContext2D, foto: ImageBitmap, alto: number) {
  const escala = Math.max(ANCHO / foto.width, alto / foto.height)
  const w = foto.width * escala
  const h = foto.height * escala
  g.drawImage(foto, (ANCHO - w) / 2, (alto - h) / 2, w, h)
  const arriba = g.createLinearGradient(0, 0, 0, 420)
  arriba.addColorStop(0, 'rgba(7,19,48,0.6)')
  arriba.addColorStop(1, 'rgba(7,19,48,0)')
  g.fillStyle = arriba
  g.fillRect(0, 0, ANCHO, 420)
  const abajo = g.createLinearGradient(0, alto * 0.35, 0, alto)
  abajo.addColorStop(0, 'rgba(7,19,48,0)')
  abajo.addColorStop(0.45, 'rgba(7,19,48,0.6)')
  abajo.addColorStop(1, 'rgba(7,19,48,0.92)')
  g.fillStyle = abajo
  g.fillRect(0, alto * 0.35, ANCHO, alto * 0.65)
}

async function lienzo(d: Diseno) {
  const estilo: Estilo = d.foto ? 'transparente' : d.fondo
  const historia = d.formato === 'historia'
  const altoTotal = historia ? ALTO_HISTORIA : ALTO_PUBLICACION
  // Esperar las tipografías de la marca para que la imagen salga bien.
  await Promise.all([
    document.fonts.load('800 120px Archivo'),
    document.fonts.load('700 48px Archivo'),
    document.fonts.load('500 36px "IBM Plex Sans"'),
    document.fonts.load('600 40px "IBM Plex Mono"'),
  ]).catch(() => {})
  const p = PALETAS[estilo]
  const c = document.createElement('canvas')
  c.width = ANCHO
  c.height = altoTotal
  const g = c.getContext('2d')!

  if (d.foto) {
    dibujarFoto(g, d.foto, altoTotal)
    g.shadowColor = 'rgba(0,0,0,0.45)'
    g.shadowBlur = 14
  } else if (estilo !== 'transparente') {
    const fondo = g.createLinearGradient(0, 0, ANCHO, altoTotal)
    if (estilo === 'azul') {
      fondo.addColorStop(0, '#071330')
      fondo.addColorStop(0.55, MARINO)
      fondo.addColorStop(1, AZUL)
    } else {
      fondo.addColorStop(0, '#FFFFFF')
      fondo.addColorStop(0.6, '#F4F7FF')
      fondo.addColorStop(1, '#E2EBFF')
    }
    g.fillStyle = fondo
    g.fillRect(0, 0, ANCHO, altoTotal)
    // Las "líneas de velocidad" del logo.
    g.save()
    g.globalAlpha = estilo === 'azul' ? 0.09 : 0.06
    g.fillStyle = estilo === 'azul' ? CELESTE : AZUL
    for (let i = 0; i < 7; i++) {
      const y = 820 + (historia ? 420 : 0) + i * 70
      g.beginPath()
      g.moveTo(-100 + i * 40, y)
      g.lineTo(ANCHO + 200, y - 520)
      g.lineTo(ANCHO + 200, y - 490)
      g.lineTo(-100 + i * 40, y + 30)
      g.fill()
    }
    g.restore()
    if (estilo === 'blanco') {
      g.fillStyle = AZUL
      g.fillRect(0, 0, ANCHO, 14)
    }
  } else {
    // Sin fondo: sombra suave para que se lea sobre cualquier foto.
    g.shadowColor = 'rgba(0,0,0,0.45)'
    g.shadowBlur = 14
  }

  const img = await cargarLogo(p.logo)
  // Desde acá todo es sincrónico: es seguro fijar el alto para esta imagen.
  ALTO = historia ? ALTO_HISTORIA - BAJADA - LIBRE_ABAJO : ALTO_PUBLICACION
  if (historia) g.translate(0, BAJADA)
  if (img) {
    const w = 330
    g.drawImage(img, M, 56, w, (img.height / img.width) * w)
  } else {
    txt(g, 'RIVERO', M, 130, TITULO(800, 64), p.texto)
  }
  return { c, g, p }
}

function txt(g: CanvasRenderingContext2D, t: string, x: number, y: number, fuente: string, color: string, alinear: CanvasTextAlign = 'left') {
  g.font = fuente
  g.fillStyle = color
  g.textAlign = alinear
  g.fillText(t, x, y)
  g.textAlign = 'left'
}

function ajustar(g: CanvasRenderingContext2D, texto: string, max: number, fuente: string) {
  g.font = fuente
  if (g.measureText(texto).width <= max) return texto
  let t = texto
  while (t.length > 3 && g.measureText(t + '…').width > max) t = t.slice(0, -1)
  return t + '…'
}

/** Achica la letra hasta que el texto entre; recién ahí lo corta con '…'. */
function caber(g: CanvasRenderingContext2D, texto: string, max: number, fuente: (px: number) => string, px: number, minimo = Math.round(px * 0.6)) {
  let n = px
  g.font = fuente(n)
  while (n > minimo && g.measureText(texto).width > max) g.font = fuente(--n)
  return { texto: ajustar(g, texto, max, fuente(n)), fuente: fuente(n) }
}

function redondeado(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2)
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function panel(g: CanvasRenderingContext2D, p: Paleta, x: number, y: number, w: number, h: number, r = 24, color = p.panel) {
  g.fillStyle = color
  redondeado(g, x, y, w, h, r)
  g.fill()
}

function encabezado(g: CanvasRenderingContext2D, p: Paleta, derecha: string) {
  txt(g, derecha, ANCHO - M, 108, TEXTO(500, 32), p.acento, 'right')
}

function pie(g: CanvasRenderingContext2D, p: Paleta, nombre: string) {
  g.fillStyle = p.suave
  g.globalAlpha = 0.35
  g.fillRect(M, ALTO - 130, ANCHO - 2 * M, 2)
  g.globalAlpha = 1
  txt(g, 'RIVERO TRACK & FIELD', M, ALTO - 66, TITULO(700, 34), p.texto)
  txt(g, ajustar(g, nombre, 420, TEXTO(500, 30)), ANCHO - M, ALTO - 66, TEXTO(500, 30), p.acento, 'right')
}

const ICONO_DATO: Record<string, string> = { Tiempo: '⏱️', Ritmo: '⚡', 'Pulso prom.': '❤️', Desnivel: '⛰️', Sesiones: '🏃', 'Km totales': '📏', Logros: '🏅', 'Total corrido': '📏', Repeticiones: '🔁', 'Vuelta prom.': '⏱️' }

/** Una píldora: ícono en un círculo de color, el valor grande y la etiqueta abajo. */
function pildora(g: CanvasRenderingContext2D, p: Paleta, x: number, y: number, w: number, alto: number, icono: string, valor: string, etiqueta: string) {
  panel(g, p, x, y, w, alto, alto / 2)
  const r = alto * 0.35
  const cx = x + alto / 2
  const cy = y + alto / 2
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fillStyle = p.acento
  g.fill()
  g.textBaseline = 'middle'
  txt(g, icono, cx, cy + 2, TEXTO(400, Math.round(r)), '#000', 'center')
  g.textBaseline = 'alphabetic'
  const ancho = w - alto - 30
  const v = caber(g, valor, ancho, (n) => MONO(700, n), Math.round(alto * 0.38), 22)
  txt(g, v.texto, x + alto + 6, y + alto * 0.5, v.fuente, p.texto)
  txt(g, ajustar(g, etiqueta.toUpperCase(), ancho, TEXTO(600, 21)), x + alto + 6, y + alto * 0.8, TEXTO(600, 21), p.suave)
}

/** Datos como píldoras, de a `cols` por fila. Devuelve dónde termina. */
function datosPildoras(g: CanvasRenderingContext2D, p: Paleta, datos: Dato[], y: number, cols = 2) {
  const gap = 18
  const col = (ANCHO - 2 * M - gap * (cols - 1)) / cols
  const alto = cols > 2 ? 96 : 104
  datos.slice(0, cols * 3).forEach((d, i) => {
    // En "Sensación" el emoji va en el círculo y el texto como valor.
    const icono = ICONO_DATO[d.etiqueta] ?? d.valor.split(' ')[0]
    const valor = ICONO_DATO[d.etiqueta] ? d.valor : d.valor.split(' ').slice(1).join(' ') || d.valor
    pildora(g, p, M + (i % cols) * (col + gap), y + Math.floor(i / cols) * (alto + 16), col, alto, icono, valor, d.etiqueta)
  })
  return y + Math.ceil(Math.min(datos.length, cols * 3) / cols) * (alto + 16)
}

function tituloGrafico(g: CanvasRenderingContext2D, p: Paleta, t: string, y: number) {
  txt(g, t.toUpperCase(), M, y, TEXTO(600, 26), p.acento)
}

/** Gráfico de barras verticales con valores arriba y etiquetas abajo. */
function graficoBarras(g: CanvasRenderingContext2D, p: Paleta, b: Barra[], y: number, h: number) {
  if (!b.length) return
  const x = M
  const w = ANCHO - 2 * M
  const max = Math.max(...b.map((v) => v.valor), 0.0001)
  const hayDestacada = b.some((v) => v.destacada)
  const iMax = b.findIndex((v) => v.valor === max)
  const paso = w / b.length
  const ancho = Math.min(104, paso * 0.62)
  const base = y + h - 46
  const alto = h - 46 - 52
  g.fillStyle = p.suave
  g.globalAlpha = 0.3
  g.fillRect(x, base + 2, w, 2)
  g.globalAlpha = 1
  b.forEach((v, i) => {
    const cx = x + paso * i + paso / 2
    const fuerte = hayDestacada ? v.destacada : i === iMax
    const hh = v.valor > 0 ? Math.max(12, (v.valor / max) * alto) : 6
    if (fuerte) {
      const grad = g.createLinearGradient(0, base - hh, 0, base)
      grad.addColorStop(0, p.acento)
      grad.addColorStop(1, p.texto === '#FFFFFF' ? AZUL : '#3B6FE0')
      g.fillStyle = grad
    } else g.fillStyle = p.acentoSuave
    redondeado(g, cx - ancho / 2, base - hh, ancho, hh, 14)
    g.fill()
    if (v.texto && v.valor > 0) txt(g, v.texto, cx, base - hh - 14, MONO(600, 26), fuerte ? p.texto : p.suave, 'center')
    txt(g, v.etiqueta, cx, base + 38, TEXTO(fuerte ? 700 : 500, 26), fuerte ? p.texto : p.suave, 'center')
  })
}

/** Ritmo de cada km: línea con área (más arriba = más rápido) y el mejor km marcado. */
function graficoRitmo(g: CanvasRenderingContext2D, p: Paleta, ritmos: number[], y: number, h: number) {
  const r = ritmos.filter((v) => v > 0).slice(0, 50)
  if (r.length < 2) return
  const x = M + 90
  const w = ANCHO - M - x
  const arriba = y + 100
  const base = y + h - 46
  const min = Math.min(...r)
  const max = Math.max(...r)
  const rango = max - min || 1
  const px = (i: number) => x + (i / (r.length - 1)) * w
  const py = (v: number) => arriba + ((v - min) / rango) * (base - 20 - arriba)
  // Guías con el ritmo más rápido y el más lento.
  for (const v of [min, max]) {
    g.fillStyle = p.suave
    g.globalAlpha = 0.25
    g.fillRect(x, py(v), w, 2)
    g.globalAlpha = 1
    txt(g, mmss(v), M, py(v) + 9, MONO(500, 26), p.suave)
  }
  const area = g.createLinearGradient(0, arriba, 0, base)
  area.addColorStop(0, p.acentoSuave)
  area.addColorStop(1, 'rgba(126,166,255,0)')
  g.beginPath()
  g.moveTo(px(0), base)
  r.forEach((v, i) => g.lineTo(px(i), py(v)))
  g.lineTo(px(r.length - 1), base)
  g.closePath()
  g.fillStyle = area
  g.fill()
  g.beginPath()
  r.forEach((v, i) => (i ? g.lineTo(px(i), py(v)) : g.moveTo(px(i), py(v))))
  g.strokeStyle = p.acento
  g.lineWidth = 7
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.stroke()
  const mejor = r.indexOf(min)
  r.forEach((v, i) => {
    g.beginPath()
    g.arc(px(i), py(v), i === mejor ? 14 : r.length > 20 ? 0 : 7, 0, Math.PI * 2)
    g.fillStyle = i === mejor ? VERDE : p.acento
    g.fill()
  })
  const lx = Math.min(Math.max(px(mejor), x + 100), x + w - 100)
  txt(g, `⚡ ${mmss(min)}/km`, lx, py(min) - 28, MONO(700, 30), p.texto, 'center')
  const cada = Math.ceil(r.length / 10)
  r.forEach((_, i) => {
    if (i % cada === 0 || i === r.length - 1) txt(g, `${i + 1}`, px(i), base + 38, TEXTO(500, 24), p.suave, 'center')
  })
}

/** Plan vs. hecho en barras horizontales, con el % cumplido. */
function graficoPlan(g: CanvasRenderingContext2D, p: Paleta, plan: number, hecho: number, unidad: string, y: number) {
  const w = ANCHO - 2 * M - 260
  const max = Math.max(plan, hecho)
  const filas = [
    { t: 'Plan', v: plan, color: p.acentoSuave },
    { t: 'Hecho', v: hecho, color: p.acento },
  ]
  filas.forEach((f, i) => {
    const yy = y + 20 + i * 90
    txt(g, f.t, M, yy + 42, TEXTO(600, 30), p.suave)
    panel(g, p, M + 120, yy + 10, w, 44, 22)
    panel(g, p, M + 120, yy + 10, Math.max(44, (f.v / max) * w), 44, 22, f.color)
    txt(g, `${f.v.toLocaleString('es-PY', { maximumFractionDigits: 1 })} ${unidad}`, M + 140 + w, yy + 44, MONO(600, 30), p.texto)
  })
  const pct = Math.round((100 * hecho) / plan)
  txt(g, `${pct}%`, ANCHO - M, y + 240, TITULO(800, 64), pct >= 95 ? VERDE : p.acento, 'right')
  txt(g, 'del plan', ANCHO - M - g.measureText(`${pct}%`).width - 16, y + 240, TEXTO(500, 28), p.suave, 'right')
}

const aBlob = (c: HTMLCanvasElement) => new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo crear la imagen'))), 'image/png'))

/** Tarjeta de un entrenamiento: número grande, datos y gráfico del ritmo por km (o plan vs. hecho). */
export async function tarjetaSesion(o: {
  estilo: Diseno
  nombre: string
  fecha: string
  tipo: string
  titulo: string
  numero: string
  unidad: string
  datos: Dato[]
  parciales?: number[] // ritmo de cada km en segundos
  plan?: { valor: number; hecho: number; unidad: string } | null
}) {
  const { c, g, p } = await lienzo(o.estilo)
  encabezado(g, p, o.fecha)
  txt(g, o.tipo.toUpperCase(), M, 290, TITULO(700, 38), p.acento)
  const tit = caber(g, o.titulo, ANCHO - 2 * M, (n) => TITULO(700, n), 52, 34)
  txt(g, tit.texto, M, 352, tit.fuente, p.texto)
  txt(g, o.numero, M - 8, 568, TITULO(800, 220), p.texto)
  const w = g.measureText(o.numero).width
  txt(g, o.unidad, M + w + 12, 568, TITULO(700, 70), p.acento)
  const fin = datosPildoras(g, p, o.datos, 612)

  const parciales = (o.parciales ?? []).filter((x) => x > 0)
  const y = Math.max(fin + 16, 880)
  if (parciales.length >= 2) {
    tituloGrafico(g, p, 'Ritmo por km · más arriba = más rápido', y)
    graficoRitmo(g, p, parciales, y, ALTO - 150 - y)
  } else if (o.plan && o.plan.valor > 0) {
    tituloGrafico(g, p, 'Plan vs. hecho', y)
    graficoPlan(g, p, o.plan.valor, o.plan.hecho, o.plan.unidad, y)
  }
  pie(g, p, o.nombre)
  return aBlob(c)
}

/** Tarjeta de lista: semana, récords, retos… con gráfico opcional arriba. */
export async function tarjetaLista(o: {
  estilo: Diseno
  nombre: string
  titulo: string
  subtitulo: string
  filas: Fila[]
  destacado?: string
  grafico?: Grafico
  mosaico?: boolean // filas como recuadros de a 2
}) {
  const { c, g, p } = await lienzo(o.estilo)
  encabezado(g, p, o.subtitulo)
  txt(g, ajustar(g, o.titulo, ANCHO - 2 * M, TITULO(800, 84)), M, 310, TITULO(800, 84), p.texto)
  let y = 350
  if (o.destacado) {
    txt(g, ajustar(g, o.destacado, ANCHO - 2 * M, TITULO(700, 44)), M, 380, TITULO(700, 44), p.acento)
    y = 410
  }
  const limite = ALTO - 160

  if (o.grafico && (o.grafico.barras?.length || (o.grafico.ritmos?.length ?? 0) >= 2)) {
    y += 30
    tituloGrafico(g, p, o.grafico.titulo, y)
    if (o.grafico.barras) graficoBarras(g, p, o.grafico.barras, y + 10, 290)
    else graficoRitmo(g, p, o.grafico.ritmos!, y, 300)
    y += 320
  } else y += 20

  if (o.mosaico) {
    const gap = 18
    const col = (ANCHO - 2 * M - gap) / 2
    const alto = 112
    const n = Math.floor((limite - y + 16) / (alto + 16)) * 2
    o.filas.slice(0, n).forEach((f, i) => {
      pildora(g, p, M + (i % 2) * (col + gap), y + Math.floor(i / 2) * (alto + 16), col, alto, f.icono, f.valor, f.texto)
    })
  } else {
    const conBarra = o.filas.some((f) => f.progreso !== undefined)
    const minimo = conBarra ? 96 : 82
    const filas = o.filas.slice(0, Math.floor((limite - y + 12) / (minimo + 12)))
    // Si son pocas filas, se agrandan para llenar la imagen.
    const alto = conBarra ? Math.min(150, Math.max(minimo, (limite - y) / filas.length - 16)) : minimo
    filas.forEach((f, i) => {
      const yy = y + i * (alto + (conBarra ? 16 : 12))
      const medio = yy + alto / 2
      panel(g, p, M, yy, ANCHO - 2 * M, alto, 20, f.cumplido ? 'rgba(61,190,122,0.22)' : p.panel)
      txt(g, f.icono, M + 24, medio + 16, TEXTO(400, conBarra && alto > 120 ? 52 : 44), p.texto)
      const valorF = MONO(600, conBarra && alto > 120 ? 40 : 36)
      txt(g, f.valor, ANCHO - M - 28, f.progreso !== undefined ? medio - 8 : medio + 13, valorF, f.cumplido ? VERDE : p.texto, 'right')
      g.font = valorF
      const anchoTexto = ANCHO - 2 * M - 130 - g.measureText(f.valor).width - 40
      if (f.progreso !== undefined) {
        const fuente = TEXTO(600, alto > 120 ? 36 : 32)
        txt(g, ajustar(g, f.texto, anchoTexto, fuente), M + 100, medio - 8, fuente, p.texto)
        const bw = ANCHO - 2 * M - 130
        const bh = alto > 120 ? 18 : 14
        panel(g, p, M + 100, medio + 14, bw, bh, bh / 2, p.acentoSuave)
        panel(g, p, M + 100, medio + 14, Math.max(bh, Math.min(1, f.progreso) * bw), bh, bh / 2, f.cumplido ? VERDE : p.acento)
      } else {
        txt(g, ajustar(g, f.texto, anchoTexto, TEXTO(500, 34)), M + 100, yy + alto / 2 + 12, TEXTO(500, 34), p.texto)
      }
    })
  }
  pie(g, p, o.nombre)
  return aBlob(c)
}

/** Tarjeta de un logro desbloqueado, como una medalla. */
export async function tarjetaLogro(o: { estilo: Diseno; nombre: string; icono: string; titulo: string; detalle: string; fecha: string; color?: string; datos?: Dato[] }) {
  const { c, g, p } = await lienzo(o.estilo)
  encabezado(g, p, o.fecha)
  // En historia la medalla queda centrada en el espacio extra.
  const dy = (ALTO - ALTO_PUBLICACION) / 2
  g.save()
  g.translate(0, dy)
  // Un color de logro muy oscuro no se ve sobre el fondo azul: se usa el celeste.
  const oscuro = (h: string) => {
    const n = parseInt(h.slice(1, 7), 16)
    return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) < 60
  }
  const fondo = o.estilo.fondo
  const color = o.color && !(fondo !== 'blanco' && oscuro(o.color)) ? o.color : fondo === 'blanco' ? AZUL : CELESTE
  const cx = ANCHO / 2
  const cy = 540
  const luz = fondo === 'blanco' ? '#7EA6FF' : CELESTE
  const brillo = g.createRadialGradient(cx, cy, 60, cx, cy, 330)
  brillo.addColorStop(0, luz + '88')
  brillo.addColorStop(1, luz + '00')
  g.fillStyle = brillo
  g.fillRect(cx - 340, cy - 340, 680, 680)
  // Cintas de la medalla
  g.fillStyle = color
  for (const s of [-1, 1]) {
    g.beginPath()
    g.moveTo(cx + s * 40, cy - 330)
    g.lineTo(cx + s * 120, cy - 330)
    g.lineTo(cx + s * 70, cy - 150)
    g.lineTo(cx - s * 10, cy - 150)
    g.closePath()
    g.fill()
  }
  g.beginPath()
  g.arc(cx, cy, 180, 0, Math.PI * 2)
  g.fillStyle = '#FFFFFF'
  g.fill()
  g.lineWidth = 18
  g.strokeStyle = color
  g.stroke()
  g.beginPath()
  g.arc(cx, cy, 150, 0, Math.PI * 2)
  g.lineWidth = 3
  g.strokeStyle = color + '66'
  g.stroke()
  g.textBaseline = 'middle'
  txt(g, o.icono, cx, cy + 8, TEXTO(400, 170), '#000', 'center')
  g.textBaseline = 'alphabetic'
  txt(g, '¡LOGRO DESBLOQUEADO!', cx, 820, TITULO(700, 40), p.acento, 'center')
  const tit = caber(g, o.titulo, ANCHO - 2 * M, (n) => TITULO(800, n), 86, 56)
  txt(g, tit.texto, cx, 912, tit.fuente, p.texto, 'center')
  txt(g, ajustar(g, o.detalle, ANCHO - 2 * M, TEXTO(500, 36)), cx, 968, TEXTO(500, 36), p.suave, 'center')
  if (o.datos?.length) datosPildoras(g, p, o.datos, 1022, 3)
  g.restore()
  pie(g, p, o.nombre)
  return aBlob(c)
}

/** Tarjeta de una carrera: tiempo grande, ritmo, objetivo y posiciones. Con foto, los datos van abajo. */
export async function tarjetaCarrera(o: {
  estilo: Diseno
  nombre: string
  carrera: string
  fecha: string
  detalle: string // "10 km · Costanera"
  tiempo: string
  ritmo: string | null
  objetivo: string | null // "¡Objetivo cumplido! 1:28 menos"
  general: string | null // "15° de 320"
  categoria: { nombre: string; puesto: string } | null
}) {
  const { c, g, p } = await lienzo(o.estilo)
  encabezado(g, p, o.fecha)
  const pildoras = [
    o.general ? { icono: '🏆', valor: o.general, etiqueta: 'Puesto general' } : null,
    o.categoria ? { icono: '🥇', valor: o.categoria.puesto, etiqueta: `Categoría ${o.categoria.nombre}` } : null,
  ].filter(Boolean) as { icono: string; valor: string; etiqueta: string }[]
  // Con foto, el tiempo un poco más chico para que se vea más la foto.
  const grande = o.estilo.foto ? 180 : 210
  const cabecera = grande + 200
  const altoBloque = cabecera + (o.ritmo ? 70 : 0) + (o.objetivo ? 56 : 0) + (pildoras.length ? 150 : 0)
  const libre = ALTO - 160 - 260 - altoBloque
  // Con foto el texto va abajo (la foto se ve arriba); sin foto, un poco centrado.
  let y = o.estilo.foto ? ALTO - 160 - altoBloque : 260 + Math.max(0, libre / 2)
  txt(g, '🏁 RESULTADO DE CARRERA', M, y + 36, TITULO(700, 36), p.acento)
  const nom = caber(g, o.carrera, ANCHO - 2 * M, (n) => TITULO(800, n), 66, 38)
  txt(g, nom.texto, M, y + 112, nom.fuente, p.texto)
  if (o.detalle) txt(g, ajustar(g, o.detalle, ANCHO - 2 * M, TEXTO(500, 34)), M, y + 166, TEXTO(500, 34), p.suave)
  const t = caber(g, o.tiempo, ANCHO - 2 * M, (n) => TITULO(800, n), grande, 110)
  txt(g, t.texto, M - 8, y + cabecera - 30, t.fuente, p.texto)
  y += cabecera
  if (o.ritmo) {
    txt(g, `⚡ ${o.ritmo}`, M, y + 46, MONO(700, 46), p.acento)
    y += 70
  }
  if (o.objetivo) {
    txt(g, ajustar(g, `✅ ${o.objetivo}`, ANCHO - 2 * M, TEXTO(700, 36)), M, y + 40, TEXTO(700, 36), VERDE)
    y += 56
  }
  if (pildoras.length) {
    const gap = 18
    const col = pildoras.length === 1 ? ANCHO - 2 * M : (ANCHO - 2 * M - gap) / 2
    pildoras.forEach((d, i) => pildora(g, p, M + i * (col + gap), y + 20, col, 120, d.icono, d.valor, d.etiqueta))
  }
  pie(g, p, o.nombre)
  return aBlob(c)
}

/** Compartir (WhatsApp, Instagram…) o, si el celular no puede, descargar el PNG. */
export async function compartirImagen(blob: Blob, nombreArchivo: string, texto: string) {
  const archivo = new File([blob], nombreArchivo, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [archivo] })) {
    try {
      await nav.share({ files: [archivo], text: texto })
      return 'compartida'
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelada'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombreArchivo
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 3000)
  return 'descargada'
}
