// Plan de carrera automático: arma como BORRADOR las últimas semanas antes de
// una competencia, bajando la carga (tapering). El entrenador lo revisa y publica.
import { diaSemana, lunesDe, sumarDias } from './fechas'
import { formatoDuracion, formatoKm } from './formato'
import { estrategiaCarrera } from './comunidad'
import { kmReps, textoReps } from './intervalos'
import type { SemanaCompleta, SesionPlan, TipoSesion } from './tipos'

export type SesionNueva = Pick<SesionPlan, 'fecha' | 'turno' | 'tipo' | 'resumen' | 'distancia_km' | 'duracion_min' | 'ritmo_min_seg' | 'ritmo_max_seg' | 'estructura' | 'notas' | 'reps' | 'rep_m' | 'rep_seg_min' | 'rep_seg_max' | 'rec_seg' | 'rec_tipo'>
export type SemanaNueva = { lunes: string; factor: number; titulo: string; nota: string; sesiones: SesionNueva[] }

type Competencia = { nombre: string; fecha: string; distancia_km: number | null; tiempo_objetivo_seg: number | null }

const redondeo = (n: number, paso: number) => Math.max(paso, Math.round(n / paso) * paso)

function escalar(s: SesionPlan, fecha: string, factor: number, nota: string): SesionNueva {
  // Pista y series: se bajan las repeticiones (la intensidad de cada una se mantiene).
  if (s.reps && s.rep_m) {
    const reps = Math.max(1, Math.round(s.reps * factor))
    const r = { reps, rep_m: s.rep_m, rep_seg_min: s.rep_seg_min ?? null, rep_seg_max: s.rep_seg_max ?? null, rec_seg: s.rec_seg ?? null, rec_tipo: s.rec_tipo ?? null }
    return { fecha, turno: s.turno, tipo: s.tipo, resumen: `${reps}×${s.rep_m}`, distancia_km: kmReps(reps, s.rep_m), duracion_min: null, ritmo_min_seg: s.ritmo_min_seg, ritmo_max_seg: s.ritmo_max_seg, estructura: textoReps(r), notas: nota, ...r }
  }
  const km = s.distancia_km ? redondeo(Number(s.distancia_km) * factor, 0.5) : null
  const min = s.duracion_min ? redondeo(s.duracion_min * factor, 5) : null
  return {
    fecha,
    turno: s.turno,
    tipo: s.tipo,
    resumen: km ? `${formatoKm(km)} km` : min ? `${min} min` : s.resumen,
    distancia_km: km,
    duracion_min: min,
    ritmo_min_seg: s.ritmo_min_seg,
    ritmo_max_seg: s.ritmo_max_seg,
    estructura: s.estructura ? `${s.estructura} (reducir volumen ~${Math.round((1 - factor) * 100)}%)` : null,
    notas: nota,
    reps: null, rep_m: null, rep_seg_min: null, rep_seg_max: null, rec_seg: null, rec_tipo: null,
  }
}

/** Tipo para el día de la carrera: uno que se llame "carrera"/"competencia"; si no, "específico". */
export function tipoCarrera(tipos: TipoSesion[]) {
  return (
    tipos.find((t) => /carrera|compet/i.test(`${t.codigo} ${t.nombre}`))?.codigo ??
    tipos.find((t) => /espec/i.test(`${t.codigo} ${t.nombre}`))?.codigo ??
    tipos.find((t) => t.codigo !== 'descanso')?.codigo ??
    'rodaje'
  )
}

/**
 * Toma como base la última semana publicada del alumno y arma:
 *  · 2 semanas antes: 80% del volumen · 1 semana antes: 65%
 *  · semana de la carrera: 40%, descanso el día anterior y la carrera.
 */
export function armarPlanCarrera(c: Competencia, base: SemanaCompleta, tipos: TipoSesion[]): SemanaNueva[] {
  const lunesCarrera = lunesDe(c.fecha)
  const activas = base.sesiones.filter((s) => s.tipo !== 'descanso')
  const enDia = (lunes: string, s: SesionPlan) => sumarDias(lunes, diaSemana(s.fecha))

  const semanas: SemanaNueva[] = [
    { lunes: sumarDias(lunesCarrera, -14), factor: 0.8, titulo: '2 semanas antes', nota: 'Bajamos un poco el volumen, mantenemos la intensidad.' },
    { lunes: sumarDias(lunesCarrera, -7), factor: 0.65, titulo: '1 semana antes', nota: 'Menos km, piernas frescas. Dormí bien.' },
  ].map((w) => ({ ...w, sesiones: activas.map((s) => escalar(s, enDia(w.lunes, s), w.factor, 'Plan de carrera')) }))

  // Semana de la carrera: solo hasta 2 días antes, suave; el día previo, descanso.
  const previas = activas
    .map((s) => ({ s, fecha: enDia(lunesCarrera, s) }))
    .filter((x) => x.fecha < sumarDias(c.fecha, -1))
    .slice(-3)
    .map((x) => escalar(x.s, x.fecha, 0.4, 'Suave: solo para soltar las piernas.'))

  const est = c.distancia_km && c.tiempo_objetivo_seg ? estrategiaCarrera(Number(c.distancia_km), c.tiempo_objetivo_seg) : null
  const carrera: SesionNueva = {
    fecha: c.fecha,
    turno: 1,
    tipo: tipoCarrera(tipos),
    resumen: `🏁 ${c.nombre}`,
    distancia_km: c.distancia_km ? Number(c.distancia_km) : null,
    duracion_min: null,
    ritmo_min_seg: est ? Math.round(est.ritmo - 5) : null,
    ritmo_max_seg: est ? Math.round(est.ritmo + 5) : null,
    estructura: est ? est.tramos.map((t) => `${t.nombre}: km ${formatoKm(t.desde)}–${formatoKm(t.hasta)}`).join(' · ') : null,
    notas: est ? `Objetivo ${formatoDuracion(c.tiempo_objetivo_seg!)}. Mirá el modo carrera en la app.` : '¡A disfrutarla!',
    reps: null, rep_m: null, rep_seg_min: null, rep_seg_max: null, rec_seg: null, rec_tipo: null,
  }
  semanas.push({ lunes: lunesCarrera, factor: 0.4, titulo: 'Semana de la carrera', nota: 'Descanso el día anterior. Comé y dormí bien. ¡Confiá en el trabajo hecho!', sesiones: [...previas, carrera] })
  return semanas
}
