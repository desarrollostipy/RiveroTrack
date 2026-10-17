// Datos de prueba: 8 alumnos con planes, sesiones, evaluaciones, cuotas y pagos.
// Lo usan el script `npm run seed` y la función de Netlify `datos-prueba`
// (botón "Cargar datos de prueba" en la app).

import type { SupabaseClient } from '@supabase/supabase-js'
import { emailDesdeCi } from '../src/lib/acceso.ts'
import { hoyPY, lunesDe, sumarDias } from '../src/lib/fechas.ts'

export const PIN_PRUEBA = '123456'
const SEMANAS_PASADAS = 8

type Nivel = 'principiante' | 'intermedio' | 'avanzado'
type AlumnoSeed = {
  ci: string | null // null = todavía sin acceso
  nombre: string
  sexo: 'F' | 'M'
  nivel: Nivel
  objetivo: string
  nacimiento: string
  altura: number
  peso: number
  comparteCiclo?: boolean
  cuota?: number
  dia?: number
  deudaMeses?: number // cuántos meses (contando el actual) debe
  sinRegistrosRecientes?: boolean
  nota?: string
}

export const ALUMNOS_PRUEBA: AlumnoSeed[] = [
  { ci: '9000001', nombre: 'Ana Benítez', sexo: 'F', nivel: 'intermedio', objetivo: "Bajar de 50' en 10K", nacimiento: '1992-04-12', altura: 164, peso: 58.4, comparteCiclo: true, nota: 'Viene de una molestia en el gemelo derecho. Cuidar volumen en pista.' },
  { ci: '9000002', nombre: 'Lucía Giménez', sexo: 'F', nivel: 'avanzado', objetivo: 'Media maratón sub 1:40', nacimiento: '1988-09-03', altura: 169, peso: 57.1 },
  { ci: '9000003', nombre: 'Sofía Ortiz', sexo: 'F', nivel: 'principiante', objetivo: 'Primer 10K', nacimiento: '1999-01-25', altura: 158, peso: 62.3, deudaMeses: 2 },
  { ci: '9000004', nombre: 'Carmen Duarte', sexo: 'F', nivel: 'intermedio', objetivo: '21K de Asunción', nacimiento: '1985-06-30', altura: 161, peso: 60.8, comparteCiclo: true, cuota: 200000, dia: 5 },
  { ci: '9000005', nombre: 'Diego Rojas', sexo: 'M', nivel: 'avanzado', objetivo: 'Maratón sub 3:15', nacimiento: '1987-11-08', altura: 178, peso: 70.2, nota: 'Trabaja por turnos: el doble turno solo miércoles.' },
  { ci: '9000006', nombre: 'Marcos Villalba', sexo: 'M', nivel: 'intermedio', objetivo: "10K sub 45'", nacimiento: '1994-02-17', altura: 175, peso: 76.5, deudaMeses: 1 },
  { ci: '9000007', nombre: 'Javier Acosta', sexo: 'M', nivel: 'principiante', objetivo: 'Correr 5K sin parar', nacimiento: '2001-07-21', altura: 172, peso: 84.0, sinRegistrosRecientes: true },
  { ci: null, nombre: 'Rodrigo Cáceres', sexo: 'M', nivel: 'intermedio', objetivo: '21K sub 1:50', nacimiento: '1990-03-14', altura: 181, peso: 79.3 },
]

// ---------- Aleatorio con semilla (siempre los mismos datos) ----------
function crearAzar(semillaInicial: number) {
  let semilla = semillaInicial
  const azar = () => {
    semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const entre = (min: number, max: number) => min + azar() * (max - min)
  const elegir = <T,>(lista: T[]) => lista[Math.floor(azar() * lista.length)]
  return { azar, entre, elegir }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const mmss = (seg: number) => `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`

// ---------- Plantilla semanal por nivel ----------
const RITMO_BASE: Record<Nivel, number> = { principiante: 400, intermedio: 335, avanzado: 290 }

type SesionPlan = {
  dia: number
  turno: 1 | 2
  tipo: string
  resumen: string
  distancia_km: number | null
  duracion_min: number | null
  ritmo_min_seg: number | null
  ritmo_max_seg: number | null
  estructura: string | null
}

function plantilla(nivel: Nivel, semana: number): SesionPlan[] {
  const b = RITMO_BASE[nivel]
  const i = { principiante: 0, intermedio: 1, avanzado: 2 }[nivel]
  const s = (dia: number, tipo: string, resumen: string, km: number | null, min: number | null, rMin: number | null, rMax: number | null, estructura: string | null = null, turno: 1 | 2 = 1): SesionPlan => ({
    dia, turno, tipo, resumen, distancia_km: km, duracion_min: min, ritmo_min_seg: rMin, ritmo_max_seg: rMax, estructura,
  })

  const reps = [6, 10, 12][i]
  const fondo = [8, 16, 22][i] + Math.min(semana, 6) * [0.5, 1, 1][i]
  const lista: SesionPlan[] = [
    s(0, 'pista', `${reps}×400`, r1(4 + reps * 0.4), null, b - 75, b - 65, `${reps}×400 @${mmss((b - 75) * 0.4)}–${mmss((b - 65) * 0.4)}, rec 1′30″`),
    s(1, 'rodaje', `${[6, 12, 14][i]} km`, [6, 12, 14][i], null, b + 15, b + 30),
    nivel === 'principiante'
      ? s(2, 'descanso', 'Descanso', null, null, null, null)
      : s(2, 'especifico', '3×2000', 10, null, b - 25, b - 15, `3×2000 @${mmss(b - 25)}–${mmss(b - 15)}, rec 3′`),
    s(3, 'rodaje', `${[30, 40, 50][i]} min`, null, [30, 40, 50][i], b + 20, b + 35),
    s(4, 'series', `${[4, 6, 8][i]}×1000`, [6, 9, 12][i], null, b - 35, b - 25, `${[4, 6, 8][i]}×1000 @${mmss(b - 35)}–${mmss(b - 25)}, rec 2′`),
    s(5, 'fondo', `Fondo ${fondo} km`, fondo, null, b + 25, b + 40),
    s(6, 'descanso', 'Descanso', null, null, null, null),
  ]
  if (nivel === 'avanzado') lista.push(s(2, 'rodaje', '6 km regenerativo', 6, null, b + 35, b + 50, null, 2))
  return lista
}

const COMENTARIOS_OK = ['Muy bien, ritmo parejo.', 'Excelente, así se hace.', 'Buen trabajo, se nota la mejora.', 'Bien controlado el ritmo.']
const COMENTARIOS_PARCIAL = ['Bien, pero te fuiste lento en la segunda mitad.', 'Cortaste antes: la próxima completá el volumen.', 'Bien el esfuerzo, ajustá el ritmo al rango.']
const COMENTARIOS_ALUMNO = ['Me sentí bien.', 'Mucho calor.', 'Piernas cargadas.', 'Salió redondo.', 'Costó arrancar.', null, null, null]

type SesionPlanificadaSeed = {
  id: string
  fecha: string
  turno: number
  tipo: string
  distancia_km: number | null
  duracion_min: number | null
  ritmo_min_seg: number | null
  ritmo_max_seg: number | null
}

// Corta con un mensaje claro si Supabase devuelve error.
async function ok<T extends { error: { message: string } | null }>(consulta: PromiseLike<T>): Promise<T & { data: any }> {
  const r = await consulta
  if (r.error) throw new Error(r.error.message)
  return r as T & { data: any }
}

export async function entrenadorId(db: SupabaseClient): Promise<string> {
  const { data } = await db.from('profiles').select('id').eq('rol', 'entrenador').maybeSingle()
  if (!data) throw new Error('Primero hay que crear el acceso del entrenador (pantalla "Primer uso").')
  return data.id
}

/** Carga UN alumno de prueba (índice 0 a 7). Si ya existe, no hace nada. */
export async function cargarAlumnoPrueba(db: SupabaseClient, indice: number, idEntrenador: string): Promise<string> {
  const a = ALUMNOS_PRUEBA[indice]
  if (!a) throw new Error('Índice de alumno de prueba inválido.')
  const { azar, entre, elegir } = crearAzar(20260925 + indice)
  const hoy = hoyPY()
  const lunesActual = lunesDe(hoy)
  const mesActual = hoy.slice(0, 8) + '01'

  const { data: yaEsta } = await db.from('alumnos').select('id').eq('nombre', a.nombre).limit(1)
  if (yaEsta?.length) return `${a.nombre} ya estaba cargado`

  // ----- Acceso -----
  let profileId: string | null = null
  if (a.ci) {
    const { data, error } = await db.auth.admin.createUser({ email: emailDesdeCi(a.ci), password: PIN_PRUEBA, email_confirm: true })
    if (error) throw new Error(`Acceso de ${a.nombre}: ${error.message}`)
    profileId = data.user.id
    await ok(db.from('profiles').insert({ id: profileId, ci: a.ci, rol: 'alumno', nombre: a.nombre, debe_cambiar_clave: false }))
  }

  // ----- Ficha (el alta genera sola la cuota del mes actual) -----
  const { data: alumno } = await ok(
    db
      .from('alumnos')
      .insert({
        profile_id: profileId,
        nombre: a.nombre,
        fecha_nacimiento: a.nacimiento,
        objetivo: a.objetivo,
        nivel: a.nivel,
        fc_max: 220 - (Number(hoy.slice(0, 4)) - Number(a.nacimiento.slice(0, 4))),
        altura_cm: a.altura,
        sexo: a.sexo,
        comparte_ciclo: a.comparteCiclo ?? false,
        cuota_mensual: a.cuota,
        dia_vencimiento: a.dia,
      })
      .select('id, cuota_mensual, dia_vencimiento')
      .single(),
  )
  const alumnoId: string = alumno.id

  if (a.nota) await ok(db.from('notas_privadas').insert({ alumno_id: alumnoId, notas: a.nota }))

  // ----- Marcas y competencias -----
  const b = RITMO_BASE[a.nivel]
  await ok(
    db.from('marcas_personales').insert([
      { alumno_id: alumnoId, distancia: '5K', tiempo_seg: Math.round((b - 30) * 5), fecha: sumarDias(hoy, -120), carrera: 'Corrida Costanera' },
      ...(a.nivel !== 'principiante' ? [{ alumno_id: alumnoId, distancia: '10K', tiempo_seg: Math.round((b - 20) * 10), fecha: sumarDias(hoy, -200), carrera: '10K Asunción' }] : []),
      ...(a.nivel === 'avanzado' ? [{ alumno_id: alumnoId, distancia: '21K', tiempo_seg: Math.round((b - 5) * 21.1), fecha: sumarDias(hoy, -300), carrera: 'Media Maratón de Asunción' }] : []),
    ]),
  )
  const km = { principiante: 10, intermedio: a.objetivo.includes('21K') ? 21.1 : 10, avanzado: a.objetivo.includes('Maratón') ? 42.2 : 21.1 }[a.nivel]
  await ok(
    db.from('competencias').insert([
      { alumno_id: alumnoId, nombre: `${km === 42.2 ? 'Maratón' : km === 21.1 ? 'Media Maratón' : '10K'} de Asunción`, fecha: sumarDias(hoy, Math.round(entre(20, 60))), distancia_km: km, tiempo_objetivo_seg: Math.round((b - 15) * km), prioridad: 'A' },
      { alumno_id: alumnoId, nombre: 'Corrida San Bernardino', fecha: sumarDias(hoy, Math.round(entre(8, 18))), distancia_km: 5, prioridad: 'C' },
    ]),
  )

  // ----- Peso: una medición por semana, con leve tendencia -----
  const tendencia = entre(-0.15, 0.05)
  await ok(
    db.from('mediciones').insert(
      Array.from({ length: SEMANAS_PASADAS }, (_, k) => ({
        alumno_id: alumnoId,
        fecha: sumarDias(hoy, -7 * (SEMANAS_PASADAS - 1 - k) - 1),
        peso_kg: r1(a.peso - tendencia * (SEMANAS_PASADAS - 1 - k) + entre(-0.3, 0.3)),
        cargado_por: k % 2 === 0 || !profileId ? idEntrenador : profileId,
      })),
    ),
  )

  // ----- Ciclo: 4 períodos, el último empezó hace 2 días -----
  if (a.sexo === 'F' && profileId) {
    let inicio = sumarDias(hoy, -2)
    const periodos = []
    for (let k = 0; k < 4; k++) {
      periodos.push({ alumno_id: alumnoId, fecha_inicio: inicio, fecha_fin: k === 0 ? null : sumarDias(inicio, 4) })
      inicio = sumarDias(inicio, -Math.round(entre(27, 30)))
    }
    await ok(db.from('ciclos_menstruales').insert(periodos))
  }

  // ----- Planes: 8 semanas pasadas + la actual publicadas, la próxima en borrador -----
  const semanas = Array.from({ length: SEMANAS_PASADAS + 2 }, (_, k) => sumarDias(lunesActual, 7 * (k - SEMANAS_PASADAS)))
  const { data: planes } = await ok(
    db
      .from('planes_semanales')
      .insert(
        semanas.map((lunes, k) => ({
          alumno_id: alumnoId,
          semana_inicio: lunes,
          estado: k <= SEMANAS_PASADAS ? 'publicado' : 'borrador',
          publicado_at: k <= SEMANAS_PASADAS ? `${sumarDias(lunes, -1)}T21:00:00-03:00` : null,
          nota_semana: k === SEMANAS_PASADAS ? 'Semana de carga. Hidratate bien, se viene calor.' : k % 4 === 3 ? 'Semana de descarga: bajamos volumen.' : null,
        })),
      )
      .select('id, semana_inicio'),
  )

  const sesiones = planes.flatMap((p: { id: string; semana_inicio: string }, k: number) =>
    plantilla(a.nivel, k).map(({ dia, ...resto }) => ({ plan_id: p.id, fecha: sumarDias(p.semana_inicio, dia), ...resto })),
  )
  const { data: planificadas } = await ok(
    db.from('sesiones_planificadas').insert(sesiones).select('id, fecha, turno, tipo, distancia_km, duracion_min, ritmo_min_seg, ritmo_max_seg'),
  )

  // ----- Sesiones registradas -----
  const registros: Record<string, unknown>[] = []
  const noHechas: { id: string; fecha: string }[] = []
  for (const sp of planificadas as SesionPlanificadaSeed[]) {
    if (sp.tipo === 'descanso' || sp.fecha > hoy) continue
    if (sp.fecha === hoy && (sp.turno === 2 || azar() < 0.5)) continue
    if (a.sinRegistrosRecientes && sp.fecha >= sumarDias(hoy, -3)) continue
    if (azar() > (a.nivel === 'principiante' ? 0.75 : 0.88)) {
      noHechas.push({ id: sp.id, fecha: sp.fecha })
      continue
    }
    // En fondos, el ritmo mejora un poco semana a semana.
    const semanasAtras = Math.floor((new Date(hoy).getTime() - new Date(sp.fecha).getTime()) / 6048e5)
    const centro = ((sp.ritmo_min_seg ?? b) + (sp.ritmo_max_seg ?? b)) / 2 + (sp.tipo === 'fondo' ? semanasAtras * 1.5 : 0)
    const ritmo = Math.round(centro + entre(-8, 14))
    const distancia = sp.distancia_km ? r2(sp.distancia_km * entre(0.85, 1.04)) : r2(((sp.duracion_min ?? 40) * 60) / ritmo)
    const fc = Math.round(entre(138, 162) + (sp.tipo === 'series' || sp.tipo === 'pista' ? 8 : 0))
    const kms = Math.floor(distancia)
    registros.push({
      alumno_id: alumnoId,
      sesion_planificada_id: sp.id,
      fecha: sp.fecha,
      origen: 'manual',
      distancia_km: distancia,
      duracion_seg: Math.round(distancia * ritmo),
      ritmo_prom_seg: ritmo,
      fc_prom: fc,
      fc_max: fc + Math.round(entre(10, 22)),
      splits: Array.from({ length: kms }, (_, n) => {
        const r = Math.round(ritmo + entre(-10, 10))
        return { km: n + 1, tiempo_seg: r, ritmo_seg: r, fc: Math.round(fc - 8 + n * (16 / Math.max(kms, 1))) }
      }),
      sensacion: Math.round(entre(2, 5.4)),
      comentario_alumno: elegir(COMENTARIOS_ALUMNO),
    })
  }
  const { data: registradas } = await ok(
    db.from('sesiones_registradas').insert(registros).select('id, sesion_planificada_id, fecha, distancia_km, ritmo_prom_seg'),
  )

  // Molestias del ciclo en sesiones cerca del inicio del período.
  if (a.sexo === 'F' && profileId) {
    const molestias = (registradas as { id: string; fecha: string }[])
      .filter((r) => r.fecha >= sumarDias(hoy, -2) || azar() < 0.15)
      .map((r) => ({ sesion_registrada_id: r.id, alumno_id: alumnoId, nivel: r.fecha >= sumarDias(hoy, -2) ? 'leves' : elegir(['ninguna', 'leves', 'fuertes']) }))
    if (molestias.length) await ok(db.from('molestias_ciclo').insert(molestias))
  }

  // ----- Evaluaciones: todo lo de hace 3+ días; lo reciente queda "por evaluar" -----
  const porId = new Map((planificadas as SesionPlanificadaSeed[]).map((sp) => [sp.id, sp]))
  const evaluaciones: Record<string, unknown>[] = []
  for (const r of registradas as { sesion_planificada_id: string; fecha: string; distancia_km: number; ritmo_prom_seg: number }[]) {
    if (r.fecha > sumarDias(hoy, -3) && azar() < 0.7) continue
    const sp = porId.get(r.sesion_planificada_id)!
    const kmPlan = sp.distancia_km ?? r.distancia_km
    const proporcion = r.distancia_km / kmPlan
    const enRango = !sp.ritmo_max_seg || r.ritmo_prom_seg <= sp.ritmo_max_seg + 5
    const resultado = proporcion >= 0.95 && enRango ? 'cumplio' : proporcion >= 0.8 ? 'parcial' : 'no_cumplio'
    evaluaciones.push({
      sesion_planificada_id: sp.id,
      resultado,
      comentario: resultado === 'cumplio' ? elegir(COMENTARIOS_OK) : elegir(COMENTARIOS_PARCIAL),
      leida_at: r.fecha < sumarDias(hoy, -4) ? `${sumarDias(r.fecha, 1)}T08:00:00-03:00` : null,
    })
  }
  for (const n of noHechas) {
    if (n.fecha <= sumarDias(hoy, -3) && azar() < 0.5) {
      evaluaciones.push({ sesion_planificada_id: n.id, resultado: 'no_cumplio', comentario: '¿Qué pasó? Avisame si tenés alguna molestia.' })
    }
  }
  if (evaluaciones.length) await ok(db.from('evaluaciones').insert(evaluaciones))

  // ----- Cuotas de los 3 meses anteriores y pagos -----
  const meses = [3, 2, 1].map((k) => {
    const d = new Date(`${mesActual}T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - k)
    return d.toISOString().slice(0, 10)
  })
  await ok(
    db
      .from('cuotas')
      .upsert(
        meses.map((m) => ({ alumno_id: alumnoId, periodo: m, monto: alumno.cuota_mensual, vencimiento: sumarDias(m, alumno.dia_vencimiento - 1) })),
        { onConflict: 'alumno_id,periodo', ignoreDuplicates: true },
      ),
  )
  const { data: cuotas } = await ok(db.from('cuotas').select('id, periodo, monto').eq('alumno_id', alumnoId).order('periodo'))

  const deuda = a.deudaMeses ?? 0
  const aPagar = (cuotas as { id: string; periodo: string; monto: number }[]).slice(0, cuotas.length - deuda)
  // Carmen pagó dos meses juntos con una sola transferencia.
  const grupos = a.nombre === 'Carmen Duarte' ? [[aPagar[0]], [aPagar[1], aPagar[2]], [aPagar[3]]] : aPagar.map((c) => [c])
  for (const grupo of grupos.filter((g) => g.every(Boolean))) {
    const ultima = grupo[grupo.length - 1]
    const medio = azar() < 0.7 ? 'transferencia' : 'efectivo'
    const fechaPago = sumarDias(ultima.periodo, Math.round(entre(1, 8)))
    const { data: pago } = await ok(
      db
        .from('pagos')
        .insert({
          alumno_id: alumnoId,
          fecha: fechaPago > hoy ? hoy : fechaPago,
          monto: grupo.reduce((t, c) => t + c.monto, 0),
          medio,
          referencia: medio === 'transferencia' ? `Comp. ${Math.round(entre(100000, 999999))}` : null,
          registrado_por: idEntrenador,
        })
        .select('id')
        .single(),
    )
    await ok(db.from('cuotas').update({ pago_id: pago.id }).in('id', grupo.map((c) => c.id)))
  }

  return a.nombre
}

/** Borra los alumnos de prueba (por nombre) y sus accesos. Los reales no se tocan. */
export async function limpiarDatosPrueba(db: SupabaseClient): Promise<{ alumnos: number; accesos: number }> {
  const cis = ALUMNOS_PRUEBA.flatMap((a) => (a.ci ? [a.ci] : []))
  const { data: perfiles } = await db.from('profiles').select('id').in('ci', cis).eq('rol', 'alumno')
  const idsPerfiles = (perfiles ?? []).map((p) => p.id)
  const { data: alumnos } = await db.from('alumnos').select('id, profile_id').in('nombre', ALUMNOS_PRUEBA.map((a) => a.nombre))
  // Solo los que no tienen acceso o cuyo acceso es de prueba.
  const ids = (alumnos ?? []).filter((a) => !a.profile_id || idsPerfiles.includes(a.profile_id)).map((a) => a.id)
  if (ids.length) {
    // Orden necesario: primero lo que tiene "on delete restrict".
    await ok(db.from('sesiones_registradas').delete().in('alumno_id', ids))
    await ok(db.from('cuotas').delete().in('alumno_id', ids))
    await ok(db.from('pagos').delete().in('alumno_id', ids))
    await ok(db.from('mediciones').delete().in('alumno_id', ids))
    await ok(db.from('alumnos').delete().in('id', ids)) // arrastra planes, ciclos, etc.
  }
  for (const id of idsPerfiles) await db.auth.admin.deleteUser(id)
  return { alumnos: ids.length, accesos: idsPerfiles.length }
}
