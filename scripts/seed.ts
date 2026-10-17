// Datos de prueba desde la terminal (alternativa al botón de la app).
//
//   npm run seed           → carga los 8 alumnos de prueba
//   npm run seed:limpiar   → borra todo lo que cargó el seed
//
// Usa la clave secreta de Supabase del archivo .env.

import { createClient } from '@supabase/supabase-js'
import { ALUMNOS_PRUEBA, PIN_PRUEBA, cargarAlumnoPrueba, entrenadorId, limpiarDatosPrueba } from './datos-prueba.ts'

const url = process.env.VITE_SUPABASE_URL
const secreta = process.env.SUPABASE_SECRET_KEY
if (!url || !secreta) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SECRET_KEY en el archivo .env')
  process.exit(1)
}
const db = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })

async function main() {
  if (process.argv.includes('--limpiar')) {
    const r = await limpiarDatosPrueba(db)
    console.log(`Borrados ${r.alumnos} alumnos de prueba y ${r.accesos} accesos.`)
    return
  }
  const entrenador = await entrenadorId(db)
  for (let i = 0; i < ALUMNOS_PRUEBA.length; i++) {
    console.log(await cargarAlumnoPrueba(db, i, entrenador))
  }
  console.log(`\nListo. Alumnos con acceso: CI 9000001 a 9000007, PIN ${PIN_PRUEBA}. Rodrigo Cáceres queda sin acceso.`)
}

main().catch((e) => {
  console.error('\nError:', e.message)
  process.exit(1)
})
