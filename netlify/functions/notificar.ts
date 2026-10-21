// Manda notificaciones push cuando pasa algo en la app:
// mensaje de chat, plan publicado, anuncio, evaluación, competencia.
// Quien llama tiene que haber iniciado sesión; los destinatarios se calculan
// acá (nunca se confía en una lista que mande el navegador).

import { createClient } from '@supabase/supabase-js'
import { enviarA, pushListo } from '../push.ts'

export const config = { path: '/api/notificar' }

const json = (cuerpo: object, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })
const corto = (t: string, n = 90) => (t.length > n ? t.slice(0, n - 1) + '…' : t)
const primerNombre = (n: string) => n.split(' ')[0]

export default async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const url = process.env.VITE_SUPABASE_URL
  const secreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreta) return json({ error: 'Falta configurar Supabase' }, 500)
  if (!pushListo()) return json({ ok: true, enviadas: 0, aviso: 'Notificaciones sin configurar' })

  const db = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  const { data: u } = token ? await db.auth.getUser(token) : { data: { user: null } }
  if (!u.user) return json({ error: 'Iniciá sesión de nuevo.' }, 401)
  const { data: yo } = await db.from('profiles').select('id, rol, nombre').eq('id', u.user.id).single()
  if (!yo) return json({ error: 'Sin perfil' }, 403)
  const esEntrenador = yo.rol === 'entrenador'
  const { data: entrenador } = await db.from('profiles').select('id').eq('rol', 'entrenador').maybeSingle()

  const p = await req.json().catch(() => ({}))
  const perfilDeAlumno = async (alumnoId: string) => (await db.from('alumnos').select('profile_id, nombre').eq('id', alumnoId).maybeSingle()).data
  let enviadas = 0

  switch (p.tipo) {
    case 'prueba':
      enviadas = await enviarA(db, [yo.id], { titulo: '🔔 ¡Listo!', cuerpo: 'Así te van a llegar los avisos de Rivero.', url: '/' })
      break

    case 'mensaje': {
      const a = await perfilDeAlumno(String(p.alumno_id))
      if (!a) break
      // El alumno solo puede avisar de su propio chat.
      if (!esEntrenador && a.profile_id !== yo.id) return json({ error: 'Sin permiso' }, 403)
      const destino = esEntrenador ? a.profile_id : entrenador?.id
      enviadas = await enviarA(db, [destino!], {
        titulo: `💬 ${esEntrenador ? 'Tu entrenador' : primerNombre(a.nombre)}`,
        cuerpo: corto(String(p.texto ?? '')),
        url: esEntrenador ? '/chat' : `/chat/${p.alumno_id}`,
        etiqueta: `chat-${p.alumno_id}`,
      })
      break
    }

    case 'plan_publicado': {
      if (!esEntrenador) return json({ error: 'Sin permiso' }, 403)
      const { data: alumnos } = await db.from('alumnos').select('profile_id').in('id', (p.alumno_ids ?? []) as string[])
      enviadas = await enviarA(db, (alumnos ?? []).map((a) => a.profile_id as string), {
        titulo: '📅 Tu plan de la semana está listo',
        cuerpo: 'Entrá para ver tus entrenamientos.',
        url: '/semana',
        etiqueta: `plan-${p.semana}`,
      })
      break
    }

    case 'anuncio': {
      if (!esEntrenador) return json({ error: 'Sin permiso' }, 403)
      const { data: an } = await db.from('anuncios').select('texto, grupo_id').eq('id', String(p.anuncio_id)).maybeSingle()
      if (!an) break
      let q = db.from('alumnos').select('profile_id').eq('activo', true).not('profile_id', 'is', null)
      if (an.grupo_id) q = q.eq('grupo_id', an.grupo_id)
      const { data: alumnos } = await q
      enviadas = await enviarA(db, (alumnos ?? []).map((a) => a.profile_id as string), { titulo: '📢 Anuncio de Rivero', cuerpo: corto(an.texto, 140), url: '/hoy' })
      break
    }

    case 'sesion': {
      // El alumno registró una sesión: aviso al entrenador.
      const { data: r } = await db
        .from('sesiones_registradas')
        .select('alumno_id, distancia_km, alumnos(nombre, profile_id), sesiones_planificadas(resumen)')
        .eq('sesion_planificada_id', String(p.sesion_planificada_id))
        .maybeSingle()
      const al = (Array.isArray(r?.alumnos) ? r?.alumnos[0] : r?.alumnos) as { nombre: string; profile_id: string } | undefined
      if (!r || !al || al.profile_id !== yo.id) break
      const sp = (Array.isArray(r.sesiones_planificadas) ? r.sesiones_planificadas[0] : r.sesiones_planificadas) as { resumen: string | null } | undefined
      enviadas = await enviarA(db, [entrenador?.id as string], {
        titulo: `🏃 ${primerNombre(al.nombre)} registró una sesión`,
        cuerpo: `${sp?.resumen ?? 'Sesión'}${r.distancia_km ? ' · ' + String(r.distancia_km).replace('.', ',') + ' km' : ''}`,
        url: `/evaluar/${p.sesion_planificada_id}`,
        etiqueta: `sesion-${p.sesion_planificada_id}`,
      })
      break
    }

    case 'evaluacion': {
      if (!esEntrenador) return json({ error: 'Sin permiso' }, 403)
      const { data: s } = await db
        .from('sesiones_planificadas')
        .select('resumen, planes_semanales(alumno_id)')
        .eq('id', String(p.sesion_planificada_id))
        .maybeSingle()
      const plan = (Array.isArray(s?.planes_semanales) ? s?.planes_semanales[0] : s?.planes_semanales) as { alumno_id: string } | undefined
      if (!plan) break
      const a = await perfilDeAlumno(plan.alumno_id)
      enviadas = await enviarA(db, [a?.profile_id as string], {
        titulo: '✅ Tu entrenador evaluó tu sesión',
        cuerpo: s?.resumen ? `Sesión: ${s.resumen}` : 'Entrá para ver el comentario.',
        url: '/semana',
      })
      break
    }

    case 'competencia': {
      const { data: c } = await db.from('competencias').select('nombre, estado, alumno_id').eq('id', String(p.competencia_id)).maybeSingle()
      if (!c) break
      const a = await perfilDeAlumno(c.alumno_id)
      if (esEntrenador) {
        const texto = c.estado === 'aprobada' ? '¡Podés correrla! 🏁' : c.estado === 'rechazada' ? 'Tu entrenador te dejó un comentario.' : 'Actualizada.'
        enviadas = await enviarA(db, [a?.profile_id as string], { titulo: `🏁 ${c.nombre}`, cuerpo: texto, url: '/carreras' })
      } else if (a && a.profile_id === yo.id) {
        enviadas = await enviarA(db, [entrenador?.id as string], {
          titulo: `🏁 ${primerNombre(a.nombre)} propone una carrera`,
          cuerpo: c.nombre,
          url: '/competencias',
        })
      }
      break
    }

    default:
      return json({ error: 'Tipo de aviso desconocido' }, 400)
  }
  return json({ ok: true, enviadas })
}
