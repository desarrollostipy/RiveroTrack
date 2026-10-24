// Ciclo menstrual personalizado: predicción con los datos de cada alumna,
// fases (si no usa anticonceptivo hormonal), síntomas y lo que aprendemos de ella.
// Todo es orientativo: no reemplaza la consulta médica.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { diasEntre, hoyPY, sumarDias } from './fechas'

export type Anticonceptivo = 'ninguno' | 'pastilla' | 'diu_hormonal' | 'implante' | 'inyeccion' | 'anillo_parche' | 'diu_cobre'
export type NivelCompartir = 'nada' | 'fase' | 'sintomas'
export type PerfilCiclo = {
  alumno_id: string
  duracion_ciclo: number | null
  duracion_periodo: number | null
  regular: boolean | null
  anticonceptivo: Anticonceptivo
  condiciones: string[]
  aviso_previo: boolean
  pausado: boolean
  compartir: NivelCompartir
}
export type RegistroCiclo = { id: string; fecha_inicio: string; fecha_fin: string | null }
export type Flujo = 'manchado' | 'leve' | 'medio' | 'abundante'
export type SintomasDia = { id: string; alumno_id: string; fecha: string; flujo: Flujo | null; colicos: number | null; sintomas: string[]; nota: string | null }
export type Fase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lútea'

export const ANTICONCEPTIVOS: { valor: Anticonceptivo; texto: string }[] = [
  { valor: 'ninguno', texto: 'Ninguno' },
  { valor: 'pastilla', texto: 'Pastilla' },
  { valor: 'diu_hormonal', texto: 'DIU hormonal' },
  { valor: 'implante', texto: 'Implante' },
  { valor: 'inyeccion', texto: 'Inyección' },
  { valor: 'anillo_parche', texto: 'Anillo / parche' },
  { valor: 'diu_cobre', texto: 'DIU de cobre' },
]
export const CONDICIONES = [
  { valor: 'sop', texto: 'SOP (ovario poliquístico)' },
  { valor: 'endometriosis', texto: 'Endometriosis' },
  { valor: 'tiroides', texto: 'Tiroides' },
  { valor: 'otra', texto: 'Otra' },
]
export const FLUJOS: { valor: Flujo; texto: string; gotas: string }[] = [
  { valor: 'manchado', texto: 'Manchado', gotas: '·' },
  { valor: 'leve', texto: 'Leve', gotas: '💧' },
  { valor: 'medio', texto: 'Medio', gotas: '💧💧' },
  { valor: 'abundante', texto: 'Abundante', gotas: '💧💧💧' },
]
export const COLICOS = ['Nada', 'Leves', 'Moderados', 'Fuertes']
export const SINTOMAS: { valor: string; texto: string; emoji: string }[] = [
  { valor: 'cansancio', texto: 'Cansancio', emoji: '🥱' },
  { valor: 'dolor_cabeza', texto: 'Dolor de cabeza', emoji: '🤕' },
  { valor: 'hinchazon', texto: 'Hinchazón', emoji: '🎈' },
  { valor: 'sensibilidad', texto: 'Sensibilidad en pechos', emoji: '💗' },
  { valor: 'dolor_espalda', texto: 'Dolor de espalda', emoji: '🔙' },
  { valor: 'animo_bajo', texto: 'Ánimo bajo', emoji: '😔' },
  { valor: 'irritabilidad', texto: 'Irritabilidad', emoji: '😤' },
  { valor: 'antojos', texto: 'Antojos', emoji: '🍫' },
  { valor: 'insomnio', texto: 'Dormí mal', emoji: '🌙' },
  { valor: 'nauseas', texto: 'Náuseas', emoji: '🤢' },
  { valor: 'acne', texto: 'Acné', emoji: '🔴' },
]

/** Con anticonceptivo hormonal no hay ovulación: no se muestran fases. */
export const esHormonal = (a: Anticonceptivo | null | undefined) => !!a && a !== 'ninguno' && a !== 'diu_cobre'

export const FASES: Record<Fase, { emoji: string; color: string; resumen: string; sugerencia: string }> = {
  menstrual: { emoji: '🌑', color: '#B3261E', resumen: 'Período', sugerencia: 'Si hay cólicos o cansancio, priorizá rodajes suaves y movilidad. Hidratate y comé hierro.' },
  folicular: { emoji: '🌒', color: '#2E7D4F', resumen: 'Energía en subida', sugerencia: 'Buen momento para series, calidad y subir cargas: el cuerpo suele recuperarse rápido.' },
  ovulatoria: { emoji: '🌕', color: '#D9A032', resumen: 'Pico de energía', sugerencia: 'Muchas alumnas rinden su mejor ritmo. Ojo con las articulaciones: calentá bien.' },
  lútea: { emoji: '🌘', color: '#6B4E8C', resumen: 'Más calor y esfuerzo', sugerencia: 'Puede costar más el mismo ritmo y subir la temperatura: más hidratación y sales, y fondos a ritmo cómodo.' },
}

const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
const desvio = (xs: number[]) => (xs.length < 2 ? 0 : Math.sqrt(media(xs.map((x) => (x - media(xs)) ** 2))))

/** Duraciones de los últimos ciclos completos (entre 18 y 60 días), de la más nueva a la más vieja. */
export function duraciones(inicios: string[]) {
  const orden = [...inicios].sort().reverse()
  const d: number[] = []
  for (let i = 0; i < Math.min(orden.length - 1, 8); i++) {
    const x = diasEntre(orden[i + 1], orden[i])
    if (x >= 18 && x <= 60) d.push(x)
  }
  return d
}

export type Estimacion = {
  dia: number
  fase: Fase | null
  duracion: number
  duracionPeriodo: number
  proximo: string
  ventana: [string, string]
  atrasado: boolean
  enPeriodo: boolean
  aprendido: boolean // true si la duración sale de sus propios ciclos
  irregular: boolean
}

/**
 * Estimación personalizada: usa el promedio y la variación de SUS ciclos
 * (o lo que ella indicó si todavía no hay datos), y su duración de período.
 */
export function estimarCicloPersonal(
  registros: RegistroCiclo[],
  fecha: string,
  perfil?: Pick<PerfilCiclo, 'duracion_ciclo' | 'duracion_periodo' | 'regular' | 'anticonceptivo' | 'condiciones'> | null,
  hormonalForzado?: boolean,
): Estimacion | null {
  const previos = registros.filter((r) => r.fecha_inicio <= fecha).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
  if (!previos.length) return null
  const ds = duraciones(previos.map((r) => r.fecha_inicio))
  const aprendido = ds.length >= 2
  const duracion = Math.round(aprendido ? media(ds.slice(0, 6)) : (perfil?.duracion_ciclo ?? ds[0] ?? 28))
  const periodos = previos.filter((r) => r.fecha_fin).map((r) => diasEntre(r.fecha_inicio, r.fecha_fin!) + 1).filter((x) => x >= 1 && x <= 12)
  const duracionPeriodo = Math.round(periodos.length ? media(periodos.slice(0, 6)) : (perfil?.duracion_periodo ?? 5))
  const irregular = perfil?.regular === false || (perfil?.condiciones ?? []).includes('sop') || desvio(ds) > 4
  const margen = Math.max(1, Math.min(7, Math.round(aprendido ? desvio(ds.slice(0, 6)) + 1 : irregular ? 4 : 2)))
  const ultimo = previos[0]
  const dia = diasEntre(ultimo.fecha_inicio, fecha) + 1
  const proximo = sumarDias(ultimo.fecha_inicio, duracion)
  const hormonal = hormonalForzado ?? esHormonal(perfil?.anticonceptivo)
  const enPeriodo = ultimo.fecha_fin ? fecha <= ultimo.fecha_fin : dia <= duracionPeriodo
  // Fases: menstrual mientras dura el período; ovulación ~14 días antes del próximo.
  const ovulacion = duracion - 14
  const fase: Fase | null = hormonal
    ? null
    : enPeriodo
      ? 'menstrual'
      : dia < ovulacion - 1
        ? 'folicular'
        : dia <= ovulacion + 1
          ? 'ovulatoria'
          : 'lútea'
  return { dia, fase, duracion, duracionPeriodo, proximo, ventana: [sumarDias(proximo, -margen), sumarDias(proximo, margen)], atrasado: sumarDias(proximo, margen) < fecha, enPeriodo, aprendido, irregular }
}

/** Fase estimada de cualquier día (para el calendario y para el entrenador). */
export function faseDelDia(registros: RegistroCiclo[], fecha: string, perfil?: Parameters<typeof estimarCicloPersonal>[2], hormonal?: boolean) {
  const e = estimarCicloPersonal(registros, fecha, perfil, hormonal)
  if (!e) return null
  // Si el día cae después del próximo período previsto, se proyecta el ciclo siguiente.
  if (fecha >= e.proximo) {
    const ciclos = Math.floor(diasEntre(e.proximo, fecha) / e.duracion)
    const inicio = sumarDias(e.proximo, ciclos * e.duracion)
    return estimarCicloPersonal([...registros, { id: 'previsto', fecha_inicio: inicio, fecha_fin: null }], fecha, perfil, hormonal)
  }
  return e
}

/**
 * Lo que aprendimos de ella: cruza fases (o días del ciclo) con su bienestar,
 * la sensación de sus sesiones y sus síntomas. Solo con datos suficientes.
 */
export function aprendizajes(o: {
  registros: RegistroCiclo[]
  perfil: PerfilCiclo | null
  bienestar: { fecha: string; energia: number; sueno: number; dolor: number; animo: number }[]
  sesiones: { fecha: string; sensacion: number | null }[]
  sintomas: SintomasDia[]
}) {
  const hormonal = esHormonal(o.perfil?.anticonceptivo)
  const textos: string[] = []
  if (o.registros.length < 2) return textos
  const faseDe = (f: string) => faseDelDia(o.registros, f, o.perfil)
  const porClave = <T,>(xs: T[], fecha: (x: T) => string, clave: (e: Estimacion) => string | null) => {
    const m = new Map<string, T[]>()
    for (const x of xs) {
      const e = faseDe(fecha(x))
      const k = e ? clave(e) : null
      if (k) m.set(k, [...(m.get(k) ?? []), x])
    }
    return m
  }

  if (!hormonal) {
    // Energía por fase.
    const energia = porClave(o.bienestar, (b) => b.fecha, (e) => e.fase)
    const prom = [...energia.entries()].filter(([, xs]) => xs.length >= 3).map(([f, xs]) => ({ f: f as Fase, v: media(xs.map((x) => x.energia)) }))
    if (prom.length >= 2) {
      const mejor = prom.reduce((a, b) => (b.v > a.v ? b : a))
      const peor = prom.reduce((a, b) => (b.v < a.v ? b : a))
      if (mejor.v - peor.v >= 0.5) textos.push(`Tu energía suele estar más alta en la fase ${mejor.f} ${FASES[mejor.f].emoji} y más baja en la ${peor.f} ${FASES[peor.f].emoji}.`)
    }
    // Sensación de las sesiones por fase.
    const ses = porClave(o.sesiones.filter((s) => s.sensacion), (s) => s.fecha, (e) => e.fase)
    const sp = [...ses.entries()].filter(([, xs]) => xs.length >= 3).map(([f, xs]) => ({ f: f as Fase, v: media(xs.map((x) => x.sensacion!)) }))
    if (sp.length >= 2) {
      const mejor = sp.reduce((a, b) => (b.v > a.v ? b : a))
      if (mejor.v - Math.min(...sp.map((x) => x.v)) >= 0.4) textos.push(`Tus entrenamientos se sienten mejor en la fase ${mejor.f}: buen momento para las sesiones más exigentes.`)
    }
  }

  // Primeros días del período (vale también con anticonceptivo hormonal).
  const inicioPeriodo = o.bienestar.filter((b) => {
    const e = faseDe(b.fecha)
    return e && e.dia <= 2
  })
  const resto = o.bienestar.filter((b) => {
    const e = faseDe(b.fecha)
    return e && e.dia > 4
  })
  if (inicioPeriodo.length >= 3 && resto.length >= 5 && media(resto.map((x) => x.energia)) - media(inicioPeriodo.map((x) => x.energia)) >= 0.6)
    textos.push('Tu energía baja los primeros 2 días del período: conviene que sean días suaves.')

  // Síntomas que se repiten en los mismos días del ciclo.
  const cuenta = new Map<string, number[]>()
  for (const s of o.sintomas) {
    const e = faseDe(s.fecha)
    if (!e) continue
    for (const x of s.sintomas) cuenta.set(x, [...(cuenta.get(x) ?? []), e.dia])
    if ((s.colicos ?? 0) >= 2) cuenta.set('colicos', [...(cuenta.get('colicos') ?? []), e.dia])
  }
  for (const [s, dias] of cuenta) {
    if (dias.length < 3) continue
    const desde = Math.min(...dias)
    const hasta = Math.max(...dias)
    const nombre = s === 'colicos' ? 'cólicos fuertes' : (SINTOMAS.find((x) => x.valor === s)?.texto.toLowerCase() ?? s)
    if (hasta - desde <= 6) textos.push(desde === hasta ? `Solés tener ${nombre} el día ${desde} de tu ciclo.` : `Solés tener ${nombre} entre el día ${desde} y el ${hasta} de tu ciclo.`)
  }
  return textos.slice(0, 5)
}

/** Sugerencia para el entrenador según la fase y los síntomas del día (orientativa). */
export function sugerenciaEntrenador(e: Estimacion | null, s?: SintomasDia | null) {
  if (s && (s.colicos ?? 0) >= 2) return 'Refiere cólicos fuertes: conviene bajar la intensidad hoy.'
  if (s && s.sintomas.some((x) => ['cansancio', 'insomnio', 'nauseas'].includes(x))) return 'Refiere cansancio o malestar: considerá una sesión más suave.'
  if (!e?.fase) return null
  if (e.fase === 'menstrual' && e.dia <= 2) return 'Primeros días del período: preguntale cómo se siente antes de una sesión fuerte.'
  if (e.fase === 'menstrual') return 'Con período: si refiere molestias, bajá la intensidad.'
  if (e.fase === 'lútea') return 'Fase lútea: puede costar más el mismo ritmo; priorizá hidratación.'
  if (e.fase === 'folicular' || e.fase === 'ovulatoria') return 'Fase favorable para sesiones de calidad.'
  return null
}

/** Datos del ciclo de la alumna conectada: registros, perfil y síntomas del último año. */
export function useCiclo(alumnoId: string) {
  const [registros, setRegistros] = useState<RegistroCiclo[]>([])
  const [perfil, setPerfil] = useState<PerfilCiclo | null | undefined>(undefined)
  const [sintomas, setSintomas] = useState<SintomasDia[]>([])
  const cargar = useCallback(async () => {
    const [r, p, s] = await Promise.all([
      supabase.from('ciclos_menstruales').select('id, fecha_inicio, fecha_fin').eq('alumno_id', alumnoId).order('fecha_inicio', { ascending: false }),
      supabase.from('perfil_ciclo').select('*').eq('alumno_id', alumnoId).maybeSingle(),
      supabase.from('sintomas_ciclo').select('*').eq('alumno_id', alumnoId).gte('fecha', sumarDias(hoyPY(), -400)).order('fecha', { ascending: false }),
    ])
    setRegistros((r.data ?? []) as RegistroCiclo[])
    setPerfil((p.data as PerfilCiclo | null) ?? null)
    setSintomas((s.data ?? []) as SintomasDia[])
  }, [alumnoId])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { registros, perfil, sintomas, recargar: cargar }
}

// ---------- Para el entrenador (solo lo que la alumna comparte) ----------
export type InfoCiclo = { nivel: NivelCompartir; duracion_ciclo: number | null; duracion_periodo: number | null; hormonal: boolean; irregular: boolean }

const perfilDesdeInfo = (i: InfoCiclo | null) =>
  i ? { duracion_ciclo: i.duracion_ciclo, duracion_periodo: i.duracion_periodo, regular: i.irregular ? false : null, anticonceptivo: 'ninguno' as Anticonceptivo, condiciones: [] } : null

/** Fase estimada de una alumna para un día, con los datos compartidos. */
export const faseCompartida = (registros: RegistroCiclo[], info: InfoCiclo | null, fecha: string) =>
  registros.length ? faseDelDia(registros, fecha, perfilDesdeInfo(info), info?.hormonal ?? false) : null

// Si la base todavía no tiene la función nueva (falta correr el SQL), se usa lo mínimo:
// sus registros y "fase y día", como antes. Solo se llama para alumnas que comparten.
const SIN_PERFIL: InfoCiclo = { nivel: 'fase', duracion_ciclo: null, duracion_periodo: null, hormonal: false, irregular: false }
export async function infoDe(alumnoId: string): Promise<InfoCiclo | null> {
  const { data, error } = await supabase.rpc('info_ciclo_alumna', { p_alumno_id: alumnoId })
  if (error) return SIN_PERFIL
  return ((Array.isArray(data) ? data[0] : data) as InfoCiclo | undefined) ?? null
}
const sintomasRecientes = (alumnoIds: string[]) =>
  supabase
    .from('sintomas_ciclo')
    .select('*')
    .in('alumno_id', alumnoIds)
    .gte('fecha', sumarDias(hoyPY(), -14))
    .then((r) => (r.error ? [] : ((r.data ?? []) as SintomasDia[])))

/** Ciclo de UNA alumna visto por el entrenador (vacío si no comparte o está en pausa). */
export function useCicloAlumna(alumnoId: string, activo: boolean) {
  const [registros, setRegistros] = useState<RegistroCiclo[]>([])
  const [info, setInfo] = useState<InfoCiclo | null>(null)
  const [sintomas, setSintomas] = useState<SintomasDia[]>([])
  useEffect(() => {
    if (!activo) return
    Promise.all([
      supabase.from('ciclos_menstruales').select('id, fecha_inicio, fecha_fin').eq('alumno_id', alumnoId).order('fecha_inicio', { ascending: false }),
      infoDe(alumnoId),
      sintomasRecientes([alumnoId]),
    ]).then(([r, fila, s]) => {
      const regs = (r.data ?? []) as RegistroCiclo[]
      setInfo(fila && regs.length ? fila : null)
      setRegistros(fila ? regs : [])
      setSintomas(fila ? s.sort((a, b) => b.fecha.localeCompare(a.fecha)) : [])
    })
  }, [alumnoId, activo])
  return { registros, info, sintomas, fase: (fecha: string) => (info ? faseCompartida(registros, info, fecha) : null) }
}

export type CicloCompartido = { registros: RegistroCiclo[]; info: InfoCiclo; sintomas: SintomasDia[] }

/** Fases de varias alumnas a la vez (agenda y planes). Pasar solo las que comparten. */
export async function cargarCiclosCompartidos(alumnoIds: string[]) {
  const m = new Map<string, CicloCompartido>()
  if (!alumnoIds.length) return m
  const [r, s] = await Promise.all([
    supabase.from('ciclos_menstruales').select('id, alumno_id, fecha_inicio, fecha_fin').in('alumno_id', alumnoIds).order('fecha_inicio', { ascending: false }),
    sintomasRecientes(alumnoIds),
  ])
  const regs = (r.data ?? []) as (RegistroCiclo & { alumno_id: string })[]
  const conDatos = [...new Set(regs.map((x) => x.alumno_id))]
  const infos = await Promise.all(conDatos.map(infoDe))
  conDatos.forEach((id, k) => {
    const info = infos[k]
    if (info) m.set(id, { registros: regs.filter((x) => x.alumno_id === id), info, sintomas: s.filter((x) => x.alumno_id === id) })
  })
  return m
}