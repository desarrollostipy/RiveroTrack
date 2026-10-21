// Lectura de una actividad PÚBLICA de Garmin Connect.
//
// Garmin no tiene API pública y sus datos completos (pulso, parciales)
// piden iniciar sesión con la cuenta del dueño. Lo que sí es público es el
// resumen que la página publica para las vistas previas de WhatsApp/redes:
//   "Distance 15.30 km | Time 1:30:04 | Pace 5:53 /km | Elevation 189 m"
// Eso es lo que se lee acá. Si Garmin lo cambia, la carga manual sigue andando.
// Probado con un link real el 18/10/2026.

export type ActividadGarmin = {
  actividad_id: string
  titulo: string | null
  descripcion: string
  distancia_km: number
  duracion_seg: number
  ritmo_prom_seg: number
  desnivel_m: number | null
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'

/** Saca el número de actividad de un link o del texto que comparte Garmin. */
export function idActividad(texto: string): string | null {
  return texto.match(/garmin\.com\/[^\s]*?activity\/(\d{6,})/i)?.[1] ?? null
}

const aSegundos = (t: string) => t.split(':').map(Number).reduce((total, n) => total * 60 + n, 0)
const numero = (t: string) => Number(t.replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'))

/** Interpreta "Distance 15.30 km | Time 1:30:04 | Pace 5:53 /km | Elevation 189 m" (en cualquier idioma). */
export function interpretarResumen(descripcion: string) {
  let distancia: number | null = null
  let duracion: number | null = null
  let ritmo: number | null = null
  let desnivel: number | null = null
  for (const parte of descripcion.split('|').map((p) => p.trim())) {
    const r = parte.match(/(\d{1,2}:\d{2})\s*\/\s*(km|mi)\b/i)
    if (r) {
      ritmo = aSegundos(r[1]) / (r[2].toLowerCase() === 'mi' ? 1.609344 : 1)
      continue
    }
    const d = parte.match(/([\d.,]+)\s*(km|mi)\b/i)
    if (d && distancia === null) {
      distancia = numero(d[1]) * (d[2].toLowerCase() === 'mi' ? 1.609344 : 1)
      continue
    }
    const t = parte.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/)
    if (t && duracion === null) {
      duracion = aSegundos(t[1])
      continue
    }
    const e = parte.match(/([\d.,]+)\s*(m|ft)\b/i)
    if (e && desnivel === null) desnivel = Math.round(numero(e[1]) * (e[2].toLowerCase() === 'ft' ? 0.3048 : 1))
  }
  return { distancia, duracion, ritmo, desnivel }
}

const meta = (html: string, prop: string) =>
  html.match(new RegExp(`<meta[^>]+property="${prop}"[^>]+content="([^"]*)"`, 'i'))?.[1]?.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') ?? null

export async function leerActividadGarmin(id: string): Promise<ActividadGarmin | null> {
  const r = await fetch(`https://connect.garmin.com/app/activity/${id}`, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-PY,es;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(9000),
  })
  if (!r.ok) return null
  const html = await r.text()
  const descripcion = meta(html, 'og:description')
  if (!descripcion) return null // actividad privada o página cambiada
  const { distancia, duracion, ritmo, desnivel } = interpretarResumen(descripcion)
  if (!distancia || !duracion) return null
  return {
    actividad_id: id,
    titulo: meta(html, 'og:title'),
    descripcion,
    distancia_km: Math.round(distancia * 100) / 100,
    duracion_seg: duracion,
    ritmo_prom_seg: Math.round(ritmo ?? duracion / distancia),
    desnivel_m: desnivel,
  }
}
