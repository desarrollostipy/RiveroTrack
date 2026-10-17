// Alta de accesos y reseteo de PIN. Corre en el servidor de Netlify porque
// usa la clave secreta de Supabase, que nunca debe llegar al navegador.
//
// Acciones:
//   crear-entrenador  → una sola vez, con el CODIGO_INSTALACION
//   crear-acceso      → el entrenador da acceso a un alumno (PIN aleatorio)
//   resetear-pin      → el entrenador genera un PIN aleatorio nuevo

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomInt, timingSafeEqual } from 'node:crypto'
import { emailDesdeCi, esCiValida, esPinValido, limpiarCi } from '../../src/lib/acceso'

export const config = { path: '/api/gestionar-acceso' }

const respuesta = (cuerpo: object, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const error = (mensaje: string, status = 400) => respuesta({ error: mensaje }, status)

const generarPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0')

export default async (req: Request) => {
  if (req.method !== 'POST') return error('Método no permitido', 405)

  const url = process.env.VITE_SUPABASE_URL
  const secreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreta) return error('Falta configurar VITE_SUPABASE_URL o SUPABASE_SECRET_KEY en Netlify.', 500)

  const admin = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })

  let pedido: Record<string, unknown>
  try {
    pedido = await req.json()
  } catch {
    return error('Pedido inválido.')
  }

  if (pedido.accion === 'crear-entrenador') return crearEntrenador(admin, pedido)

  // El resto de las acciones las puede hacer solo el entrenador.
  if (!(await esEntrenador(admin, req))) return error('Solo el entrenador puede hacer esto.', 403)

  if (pedido.accion === 'crear-acceso') return crearAcceso(admin, pedido)
  if (pedido.accion === 'resetear-pin') return resetearPin(admin, pedido)
  return error('Acción desconocida.')
}

async function esEntrenador(admin: SupabaseClient, req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return false
  const { data } = await admin.auth.getUser(token)
  if (!data.user) return false
  const { data: perfil } = await admin.from('profiles').select('rol').eq('id', data.user.id).maybeSingle()
  return perfil?.rol === 'entrenador'
}

function codigoCorrecto(recibido: unknown) {
  const esperado = process.env.CODIGO_INSTALACION
  if (!esperado || typeof recibido !== 'string') return false
  const a = Buffer.from(recibido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Crea el usuario de Auth + su perfil. Si el perfil falla, borra el usuario.
async function crearUsuario(
  admin: SupabaseClient,
  datos: { ci: string; pin: string; nombre: string; rol: 'entrenador' | 'alumno' },
): Promise<{ id: string } | { error: string }> {
  const { data: existente } = await admin.from('profiles').select('id').eq('ci', datos.ci).maybeSingle()
  if (existente) return { error: 'Ya existe un acceso con esa CI.' }

  const { data, error: errAuth } = await admin.auth.admin.createUser({
    email: emailDesdeCi(datos.ci),
    password: datos.pin,
    email_confirm: true,
  })
  if (errAuth || !data.user) {
    return { error: errAuth?.message.includes('already') ? 'Ya existe un acceso con esa CI.' : 'No se pudo crear el acceso.' }
  }

  const { error: errPerfil } = await admin.from('profiles').insert({
    id: data.user.id,
    ci: datos.ci,
    rol: datos.rol,
    nombre: datos.nombre,
    debe_cambiar_clave: datos.rol === 'alumno',
  })
  if (errPerfil) {
    await admin.auth.admin.deleteUser(data.user.id)
    return { error: 'No se pudo crear el perfil.' }
  }
  return { id: data.user.id }
}

async function crearEntrenador(admin: SupabaseClient, p: Record<string, unknown>) {
  if (!process.env.CODIGO_INSTALACION) return error('Falta configurar CODIGO_INSTALACION en Netlify.', 500)
  if (!codigoCorrecto(p.codigo)) return error('El código de instalación no es correcto.', 403)

  const { data: yaHay } = await admin.from('profiles').select('id').eq('rol', 'entrenador').limit(1)
  if (yaHay?.length) return error('El acceso del entrenador ya fue creado.', 409)

  const ci = limpiarCi(String(p.ci ?? ''))
  const nombre = String(p.nombre ?? '').trim()
  const pin = String(p.pin ?? '')
  if (!esCiValida(ci) || !nombre || !esPinValido(pin)) return error('Revisá la CI, el nombre y el PIN.')

  const r = await crearUsuario(admin, { ci, pin, nombre, rol: 'entrenador' })
  return 'error' in r ? error(r.error) : respuesta({ ok: true })
}

async function crearAcceso(admin: SupabaseClient, p: Record<string, unknown>) {
  const ci = limpiarCi(String(p.ci ?? ''))
  if (!esCiValida(ci)) return error('La CI tiene que ser solo números.')

  const { data: alumno } = await admin
    .from('alumnos')
    .select('id, nombre, profile_id')
    .eq('id', String(p.alumno_id ?? ''))
    .maybeSingle()
  if (!alumno) return error('No se encontró el alumno.', 404)
  if (alumno.profile_id) return error('Este alumno ya tiene acceso. Si olvidó su PIN, reseteálo.')

  const pin = generarPin()
  const r = await crearUsuario(admin, { ci, pin, nombre: alumno.nombre, rol: 'alumno' })
  if ('error' in r) return error(r.error)

  const { error: errVinculo } = await admin.from('alumnos').update({ profile_id: r.id }).eq('id', alumno.id)
  if (errVinculo) {
    await admin.auth.admin.deleteUser(r.id)
    return error('No se pudo vincular el acceso con la ficha.')
  }
  return respuesta({ ok: true, pin })
}

async function resetearPin(admin: SupabaseClient, p: Record<string, unknown>) {
  const { data: alumno } = await admin
    .from('alumnos')
    .select('profile_id')
    .eq('id', String(p.alumno_id ?? ''))
    .maybeSingle()
  if (!alumno?.profile_id) return error('Este alumno todavía no tiene acceso.', 404)

  const pin = generarPin()
  const { error: errAuth } = await admin.auth.admin.updateUserById(alumno.profile_id, { password: pin })
  if (errAuth) return error('No se pudo resetear el PIN.')

  await admin.from('profiles').update({ debe_cambiar_clave: true }).eq('id', alumno.profile_id)
  return respuesta({ ok: true, pin })
}
