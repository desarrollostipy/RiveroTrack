// Calorías quemadas (estimadas) para tener una referencia de la energía de cada día.
// Si el reloj las da, se usan esas. Si no, se estiman:
//   * Correr: con pulso y edad, fórmula de Keytel (2005); si no, ≈ 1 kcal por kg y por km.
//   * Calentamiento/afloje: ≈ 1 kcal por kg y por km (o por minutos si no hay km).
//   * Otras actividades: MET de cada deporte × peso × horas.
//   * Gasto basal (Mifflin-St Jeor) × 1,2 para el resto del día.
// Todo es orientativo: no es un dato médico ni un plan de alimentación.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { edad, hoyPY, sumarDias } from './fechas'
import { miles } from './formato'
import type { ActividadExtra, Deporte } from './extras'
import { cargarCompetenciasHechas, yaRegistrada, type CompetenciaHecha } from './competenciasSemana'

export type DatosCuerpo = { kg: number; pesoReal: boolean; sexo: 'F' | 'M'; edad: number | null; altura: number | null }
export type SesionEnergia = {
  fecha: string
  distancia_km: number | null
  duracion_seg: number | null
  calentamiento_km?: number | null
  calentamiento_min?: number | null
  afloje_km?: number | null
  afloje_min?: number | null
  calentamiento_fc_prom?: number | null
  afloje_fc_prom?: number | null
  fc_prom: number | null
  calorias?: number | null
}
export type ExtraEnergia = Pick<ActividadExtra, 'fecha' | 'deporte' | 'duracion_min' | 'distancia_km' | 'fc_prom'> & { calorias?: number | null }

const MET: Record<Deporte, number> = { natacion: 7, bicicleta: 7.5, gimnasio: 5, caminata: 3.8, yoga: 2.5, futbol: 8, padel: 6.5, otro: 5 }

/** Keytel: kcal por minuto según pulso, peso, edad y sexo. Solo con pulsos razonables. */
function keytel(fc: number | null, minutos: number, c: DatosCuerpo) {
  if (!fc || fc < 90 || fc > 210 || !c.edad || minutos <= 0) return null
  const porMin =
    c.sexo === 'M'
      ? (-55.0969 + 0.6309 * fc + 0.1988 * c.kg + 0.2017 * c.edad) / 4.184
      : (-20.4022 + 0.4472 * fc - 0.1263 * c.kg + 0.074 * c.edad) / 4.184
  return porMin > 0 ? porMin * minutos : null
}

/** Kcal de una sesión de carrera (con calentamiento y afloje). */
export function kcalSesion(s: SesionEnergia, c: DatosCuerpo) {
  if (s.calorias) return { kcal: s.calorias, delReloj: true }
  const km = Number(s.distancia_km ?? 0)
  const min = (s.duracion_seg ?? 0) / 60
  const principal = keytel(s.fc_prom, min, c) ?? km * c.kg
  // Calentamiento/afloje: con pulso y minutos, Keytel; si no, por km; si no, por minutos.
  const parte = (k?: number | null, m?: number | null, fc?: number | null) =>
    (m ? keytel(fc ?? null, Number(m), c) : null) ?? (k ? Number(k) * c.kg : m ? (7 * c.kg * Number(m)) / 60 : 0)
  return {
    kcal: Math.round(principal + parte(s.calentamiento_km, s.calentamiento_min, s.calentamiento_fc_prom) + parte(s.afloje_km, s.afloje_min, s.afloje_fc_prom)),
    delReloj: false,
  }
}

/** Kcal de una actividad extra (natación, bici, gimnasio…). */
export function kcalExtra(x: ExtraEnergia, c: DatosCuerpo) {
  if (x.calorias) return { kcal: x.calorias, delReloj: true }
  const horas = x.duracion_min / 60
  let met = MET[x.deporte]
  // En bici y caminata, la velocidad cambia mucho el esfuerzo.
  if (x.distancia_km && horas > 0) {
    const v = Number(x.distancia_km) / horas
    if (x.deporte === 'bicicleta') met = v < 16 ? 4 : v < 19 ? 6 : v < 22 ? 8 : v < 25 ? 10 : 12
    if (x.deporte === 'caminata') met = v < 4 ? 3 : v < 5.5 ? 3.8 : 5
  }
  const conPulso = x.deporte !== 'natacion' ? keytel(x.fc_prom, x.duracion_min, c) : null
  return { kcal: Math.round(conPulso ?? met * c.kg * horas), delReloj: false }
}

/** Gasto basal del día (Mifflin-St Jeor) × 1,2 por la actividad cotidiana. Null si faltan datos. */
export function kcalReposo(c: DatosCuerpo) {
  if (!c.edad || !c.altura || !c.pesoReal) return null
  const basal = 10 * c.kg + 6.25 * c.altura - 5 * c.edad + (c.sexo === 'M' ? 5 : -161)
  return Math.round(basal * 1.2)
}

export type DiaEnergia = { fecha: string; entrenamiento: number; reposo: number | null; partes: { texto: string; kcal: number; delReloj: boolean }[] }

/** Peso, edad y altura del alumno (el peso, de su última medición). */
export async function cargarCuerpo(alumnoId: string): Promise<DatosCuerpo> {
  const [a, m] = await Promise.all([
    supabase.from('alumnos').select('sexo, fecha_nacimiento, altura_cm').eq('id', alumnoId).maybeSingle(),
    supabase.from('mediciones').select('peso_kg').eq('alumno_id', alumnoId).order('fecha', { ascending: false }).limit(1).maybeSingle(),
  ])
  const al = a.data as { sexo: 'F' | 'M'; fecha_nacimiento: string | null; altura_cm: number | null } | null
  const kg = Number((m.data as { peso_kg: number } | null)?.peso_kg ?? 0)
  const sexo = al?.sexo ?? 'M'
  return { kg: kg || (sexo === 'F' ? 60 : 72), pesoReal: !!kg, sexo, edad: edad(al?.fecha_nacimiento ?? null, hoyPY()), altura: al?.altura_cm ?? null }
}

/** Kcal de una competencia: running/pista como una sesión; natación y ciclismo por MET (ritmo de competencia). */
export function kcalCompetencia(c: CompetenciaHecha, cuerpo: DatosCuerpo) {
  if (c.disciplina === 'running' || c.disciplina === 'pista') return kcalSesion({ fecha: c.fecha, distancia_km: c.km, duracion_seg: c.tiempo_seg, fc_prom: null }, cuerpo).kcal
  const horas = c.tiempo_seg / 3600
  let met = 8.3 // natación a ritmo de competencia
  if (c.disciplina === 'ciclismo') {
    const v = c.km && horas > 0 ? c.km / horas : 25
    met = v < 22 ? 8 : v < 25 ? 10 : v < 30 ? 12 : 15.8
  }
  return Math.round(met * cuerpo.kg * horas)
}

/** Calorías por día entre dos fechas (sesiones, actividades extra y competencias). */
export function useEnergia(alumnoId: string, desde: string, hasta: string, version = 0) {
  const [datos, setDatos] = useState<{ cuerpo: DatosCuerpo; dias: DiaEnergia[] } | null>(null)
  useEffect(() => {
    let vigente = true
    // Si todavía no se corrió el SQL de calorías, se pide sin esa columna (todo estimado).
    // Igual con el pulso del calentamiento y del afloje: se prueba de lo más completo a lo mínimo.
    const leer = async (tabla: string, columnas: string, nuevas = '') => {
      const q = (c: string) => supabase.from(tabla).select(c).eq('alumno_id', alumnoId).gte('fecha', desde).lte('fecha', hasta)
      for (const c of [nuevas && `${columnas}, calorias, ${nuevas}`, `${columnas}, calorias`, columnas].filter(Boolean)) {
        const r = await q(c)
        if (!r.error) return r.data ?? []
      }
      return []
    }
    Promise.all([
      cargarCuerpo(alumnoId),
      leer('sesiones_registradas', 'fecha, distancia_km, duracion_seg, calentamiento_km, calentamiento_min, afloje_km, afloje_min, fc_prom', 'calentamiento_fc_prom, afloje_fc_prom'),
      leer('actividades_extra', 'fecha, deporte, duracion_min, distancia_km, fc_prom'),
      cargarCompetenciasHechas(alumnoId, desde, hasta),
    ]).then(([cuerpo, s, x, comps]) => {
      if (!vigente) return
      const ses = s as unknown as SesionEnergia[]
      const ext = x as unknown as ExtraEnergia[]
      const reposo = kcalReposo(cuerpo)
      const dias: DiaEnergia[] = []
      for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
        const partes = [
          ...ses.filter((y) => y.fecha === f).map((y) => ({ texto: '🏃 Correr', ...kcalSesion(y, cuerpo) })),
          ...ext.filter((y) => y.fecha === f).map((y) => ({ texto: EMOJI[y.deporte], ...kcalExtra(y, cuerpo) })),
          // Sin contar dos veces: si ya se registró como sesión (o como actividad extra del mismo deporte).
          ...comps
            .filter((c) => c.fecha === f && !yaRegistrada(c, ses) && !ext.some((y) => y.fecha === f && y.deporte === (c.disciplina === 'natacion' ? 'natacion' : c.disciplina === 'ciclismo' ? 'bicicleta' : '')))
            .map((c) => ({ texto: `🏁 ${c.nombre}`, kcal: kcalCompetencia(c, cuerpo), delReloj: false })),
        ]
        dias.push({ fecha: f, entrenamiento: partes.reduce((t, p) => t + p.kcal, 0), reposo, partes })
      }
      setDatos({ cuerpo, dias })
    })
    return () => {
      vigente = false
    }
  }, [alumnoId, desde, hasta, version])
  return datos
}

const EMOJI: Record<Deporte, string> = {
  natacion: '🏊 Natación',
  bicicleta: '🚴 Bici',
  gimnasio: '🏋️ Gimnasio',
  caminata: '🚶 Caminata',
  yoga: '🧘 Yoga',
  futbol: '⚽ Fútbol',
  padel: '🎾 Pádel',
  otro: '✨ Otra',
}

export const formatoKcal = (n: number) => `${miles(n)} kcal`
