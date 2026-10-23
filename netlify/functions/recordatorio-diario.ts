// Todos los días a las 20:00 de Paraguay (23:00 UTC) avisa a cada alumno
// qué entrenamiento tiene mañana. Netlify la corre sola (función programada).

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { enviarA, pushListo } from '../push.ts'

export const config = { schedule: '0 23 * * *' }

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default async () => {
  const url = process.env.VITE_SUPABASE_URL
  const secreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !secreta || !pushListo()) return new Response('sin configurar')
  const db = createClient(url, secreta, { auth: { persistSession: false, autoRefreshToken: false } })

  // "Mañana" en Asunción.
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const d = new Date(`${hoy}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  const manana = d.toISOString().slice(0, 10)

  const { data } = await db
    .from('sesiones_planificadas')
    .select('turno, tipo, resumen, distancia_km, duracion_min, ritmo_min_seg, ritmo_max_seg, planes_semanales!inner(estado, alumnos!inner(profile_id, activo))')
    .eq('fecha', manana)
    .neq('tipo', 'descanso')
    .eq('planes_semanales.estado', 'publicado')

  // Agrupar por alumno (puede haber doble turno).
  const porPerfil = new Map<string, string[]>()
  for (const s of (data ?? []) as Record<string, any>[]) {
    const plan = Array.isArray(s.planes_semanales) ? s.planes_semanales[0] : s.planes_semanales
    const alumno = Array.isArray(plan?.alumnos) ? plan.alumnos[0] : plan?.alumnos
    if (!alumno?.profile_id || !alumno.activo) continue
    const ritmo = s.ritmo_min_seg && s.ritmo_max_seg ? ` · ${mmss(s.ritmo_min_seg)}–${mmss(s.ritmo_max_seg)}/km` : ''
    const texto = `${s.resumen || s.tipo}${ritmo}`
    porPerfil.set(alumno.profile_id, [...(porPerfil.get(alumno.profile_id) ?? []), texto])
  }

  let enviadas = 0
  for (const [perfil, sesiones] of porPerfil) {
    enviadas += await enviarA(db, [perfil], {
      titulo: '🏃 Mañana tenés entrenamiento',
      cuerpo: sesiones.join(' / '),
      url: '/hoy',
      etiqueta: `manana-${manana}`,
    })
  }
  enviadas += await avisoCiclo(db, hoy)
  return new Response(`Avisos enviados: ${enviadas}`)
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5)

// Ciclo: a quien lo pidió, 2 días antes del período previsto (sin anticonceptivo hormonal ni pausa).
// El texto es discreto porque se ve en la pantalla bloqueada.
async function avisoCiclo(db: SupabaseClient, hoy: string) {
  const { data: perfiles } = await db
    .from('perfil_ciclo')
    .select('alumno_id, duracion_ciclo, alumnos!inner(profile_id, activo, sexo)')
    .eq('aviso_previo', true)
    .eq('pausado', false)
    .in('anticonceptivo', ['ninguno', 'diu_cobre'])
  let enviadas = 0
  for (const p of (perfiles ?? []) as Record<string, any>[]) {
    const alumno = Array.isArray(p.alumnos) ? p.alumnos[0] : p.alumnos
    if (!alumno?.profile_id || !alumno.activo || alumno.sexo !== 'F') continue
    const { data: regs } = await db.from('ciclos_menstruales').select('fecha_inicio').eq('alumno_id', p.alumno_id).order('fecha_inicio', { ascending: false }).limit(7)
    const inicios = ((regs ?? []) as { fecha_inicio: string }[]).map((r) => r.fecha_inicio)
    if (!inicios.length) continue
    // Promedio de sus últimos ciclos (o lo que ella indicó, o 28 días).
    const ds = inicios.slice(1).map((x, i) => diasEntre(x, inicios[i])).filter((x) => x >= 18 && x <= 60)
    const duracion = Math.round(ds.length >= 2 ? ds.reduce((a, b) => a + b, 0) / ds.length : (p.duracion_ciclo ?? ds[0] ?? 28))
    if (diasEntre(hoy, inicios[0]) + duracion !== 2) continue
    enviadas += await enviarA(db, [alumno.profile_id], {
      titulo: '🌸 Mi ciclo',
      cuerpo: 'En unos 2 días empieza tu ventana prevista. Tocá para ver tus consejos.',
      url: '/ciclo',
      etiqueta: `ciclo-${hoy}`,
    })
  }
  return enviadas
}
