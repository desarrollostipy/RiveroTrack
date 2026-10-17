import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const clavePublica = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const configFaltante = !url || !clavePublica

// Solo la clave pública llega al navegador. La secreta vive en Netlify.
export const supabase = createClient(url ?? 'http://localhost', clavePublica ?? 'sin-clave')
