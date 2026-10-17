import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

// Si falta una variable o la URL está mal escrita, la app muestra un aviso
// en lugar de quedar en blanco.
export const configFaltante = !url || !/^https:\/\/[^\s"']+$/.test(url.trim()) || !clavePublica

// Solo la clave pública llega al navegador. La secreta vive en Netlify.
export const supabase = createClient(
  configFaltante ? 'http://localhost' : url!.trim(),
  clavePublica?.trim() || 'sin-clave',
)
