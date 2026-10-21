// Panel de alertas del entrenador: quién necesita atención hoy.
import { supabase } from './supabase'
import { diasEntre, hoyPY, lunesDe, sumarDias } from './fechas'
import { formatoFecha, formatoGs } from './formato'
import { puntajeBienestar, semaforoCarga, textoMolestia, type Bienestar, type Molestia } from './salud'

export type Nivel = 'rojo' | 'amarillo'
export type Alerta = { alumnoId: string; nombre: string; nivel: Nivel; icono: string; titulo: string; detalle: string; tab: string }
export type Carga = { alumnoId: string; nombre: string; semaforo: ReturnType<typeof semaforoCarga>; kmSemanas: number[] }

type AlumnoMin = { id: string; nombre: string }
type Semana = { alumno_id: string; semana_inicio: string; km_real: number; sesiones_plan: number; sesiones_hechas: number }
type CuotaMin = { alumno_id: string; vencimiento: string; monto: number }

let memoria: { cuando: number; datos: { alertas: Alerta[]; cargas: Carga[] } } | null = null

/** Junta todo lo que el entrenador debería mirar. Se guarda 2 minutos en memoria. */
export async function cargarAlertas(forzar = false) {
  if (!forzar && memoria && Date.now() - memoria.cuando < 120_000) return memoria.datos
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  const [al, se, mo, bi, cu, re] = await Promise.all([
    supabase.from('alumnos').select('id, nombre').eq('activo', true).order('nombre'),
    supabase.from('v_resumen_semanal').select('alumno_id, semana_inicio, km_real, sesiones_plan, sesiones_hechas').gte('semana_inicio', sumarDias(lunes, -35)),
    supabase.from('molestias').select('*').is('resuelta_at', null),
    supabase.from('bienestar_diario').select('*').gte('fecha', sumarDias(hoy, -1)),
    supabase.from('cuotas').select('alumno_id, vencimiento, monto').eq('estado', 'pendiente').lte('vencimiento', sumarDias(hoy, 5)),
    supabase.from('sesiones_registradas').select('alumno_id, fecha').gte('fecha', sumarDias(hoy, -60)).order('fecha', { ascending: false }),
  ])
  const alumnos = (al.data ?? []) as AlumnoMin[]
  const semanas = ((se.data ?? []) as Semana[]).map((s) => ({ ...s, km_real: Number(s.km_real) }))
  const molestias = (mo.data ?? []) as Molestia[]
  const bienestar = (bi.data ?? []) as Bienestar[]
  const cuotas = (cu.data ?? []) as CuotaMin[]
  const ultimoRegistro = new Map<string, string>()
  for (const r of (re.data ?? []) as { alumno_id: string; fecha: string }[]) if (!ultimoRegistro.has(r.alumno_id)) ultimoRegistro.set(r.alumno_id, r.fecha)

  const alertas: Alerta[] = []
  const cargas: Carga[] = []

  for (const a of alumnos) {
    const A = (nivel: Nivel, icono: string, titulo: string, detalle: string, tab = 'salud') => alertas.push({ alumnoId: a.id, nombre: a.nombre, nivel, icono, titulo, detalle, tab })

    // Molestias sin resolver.
    for (const m of molestias.filter((x) => x.alumno_id === a.id))
      if (m.intensidad >= 4) A(m.intensidad >= 7 ? 'rojo' : 'amarillo', '🩹', `${textoMolestia(m)} · ${m.intensidad}/10`, `Desde el ${formatoFecha(m.fecha)}${m.nota ? ` · ${m.nota}` : ''}`)

    // Bienestar de hoy o ayer.
    const b = bienestar.filter((x) => x.alumno_id === a.id).sort((x, y) => y.fecha.localeCompare(x.fecha))[0]
    if (b) {
      const p = puntajeBienestar(b)
      const cuando = b.fecha === hoy ? 'hoy' : 'ayer'
      if (b.dolor >= 4) A('rojo', '😣', `Marcó ${b.dolor === 5 ? 'mucho' : 'bastante'} dolor ${cuando}`, b.nota ?? `Bienestar ${p}/100`)
      else if (p < 35) A('rojo', '☀️', `Bienestar bajo ${cuando} (${p})`, b.nota ?? 'Durmió mal o con poca energía')
      else if (p < 50) A('amarillo', '☀️', `Bienestar regular ${cuando} (${p})`, b.nota ?? 'Conviene preguntarle cómo está')
    }

    // Semanas: carga y cumplimiento.
    const mias = semanas.filter((s) => s.alumno_id === a.id)
    const kmSemanas = Array.from({ length: 5 }, (_, i) => {
      const lun = sumarDias(lunes, -35 + i * 7)
      return mias.find((s) => s.semana_inicio === lun)?.km_real ?? 0
    })
    const semaforo = semaforoCarga(kmSemanas)
    cargas.push({ alumnoId: a.id, nombre: a.nombre, semaforo, kmSemanas })
    if (semaforo.color === 'rojo') A('rojo', '🚦', 'Subida brusca de carga', `${semaforo.texto}: ${Math.round(semaforo.ultima)} km la semana pasada`, 'evolucion')
    else if (semaforo.color === 'amarillo') A('amarillo', '🚦', 'Bajó la carga', `${semaforo.texto} respecto de su promedio`, 'evolucion')

    const dos = mias.filter((s) => s.semana_inicio === sumarDias(lunes, -7) || s.semana_inicio === sumarDias(lunes, -14))
    const plan = dos.reduce((t, s) => t + s.sesiones_plan, 0)
    const hechas = dos.reduce((t, s) => t + s.sesiones_hechas, 0)
    if (plan >= 3 && hechas / plan < 0.6) A('amarillo', '📉', `Cumplimiento bajo (${Math.round((100 * hechas) / plan)}%)`, `${hechas} de ${plan} sesiones en las últimas 2 semanas`, 'semana')

    // Sin registrar hace una semana o más (si tiene plan).
    const tienePlan = mias.some((s) => s.semana_inicio >= sumarDias(lunes, -7) && s.sesiones_plan > 0)
    const ultimo = ultimoRegistro.get(a.id)
    const dias = ultimo ? diasEntre(ultimo, hoy) : null
    if (tienePlan && (dias === null || dias >= 7)) A(dias !== null && dias < 14 ? 'amarillo' : 'rojo', '⏳', dias === null ? 'No registró sesiones' : `Sin registrar hace ${dias} días`, ultimo ? `Última: ${formatoFecha(ultimo)}` : 'Tiene plan pero no cargó nada', 'semana')

    // Cuotas.
    for (const c of cuotas.filter((x) => x.alumno_id === a.id)) {
      const vencida = c.vencimiento < hoy
      A(vencida ? 'rojo' : 'amarillo', '💳', vencida ? 'Cuota vencida' : 'Cuota por vencer', `${formatoGs(c.monto)} · ${vencida ? 'venció' : 'vence'} el ${formatoFecha(c.vencimiento)}`, 'pagos')
    }
  }

  const orden = { rojo: 0, amarillo: 1 }
  alertas.sort((x, y) => orden[x.nivel] - orden[y.nivel] || x.nombre.localeCompare(y.nombre))
  const datos = { alertas, cargas }
  memoria = { cuando: Date.now(), datos }
  return datos
}
