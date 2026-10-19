// Reglas de negocio que se calculan en la app: estado de cada día,
// alertas, cuotas, km planificados y estimación del ciclo.

import { diaSemana, diasEntre, diasDeSemana, haceDias, nombreMes, sumarDias } from './fechas'
import { formatoGs } from './formato'
import type { Cuota, Resultado, SemanaCompleta, SesionCompleta, SesionPlan } from './tipos'

// ---------- Km ----------

// Si la sesión solo tiene tiempo, se estiman los km con el ritmo medio del rango.
export function kmPlanificados(s: Pick<SesionPlan, 'distancia_km' | 'duracion_min' | 'ritmo_min_seg' | 'ritmo_max_seg' | 'tipo'>) {
  if (s.tipo === 'descanso') return { km: 0, estimado: false }
  if (s.distancia_km) return { km: s.distancia_km, estimado: false }
  const a = s.ritmo_min_seg ?? s.ritmo_max_seg
  const b = s.ritmo_max_seg ?? s.ritmo_min_seg
  if (s.duracion_min && a && b) return { km: Math.round(((s.duracion_min * 60) / ((a + b) / 2)) * 10) / 10, estimado: true }
  return { km: 0, estimado: false }
}

export function resumenSemana(sesiones: SesionCompleta[]) {
  const activas = sesiones.filter((s) => s.tipo !== 'descanso')
  const kmPlan = activas.reduce((t, s) => t + kmPlanificados(s).km, 0)
  const kmReal = sesiones.reduce((t, s) => t + (s.registro?.distancia_km ?? 0), 0)
  const hechas = activas.filter((s) => s.registro).length
  return { kmPlan, kmReal, plan: activas.length, hechas, estimado: activas.some((s) => kmPlanificados(s).estimado) }
}

// ---------- Ritmo respecto al rango ----------

export type EnRango = 'en_rango' | 'lento' | 'rapido' | null
export function compararRitmo(ritmo: number | null, min: number | null, max: number | null, tolerancia = 5): EnRango {
  if (!ritmo || (!min && !max)) return null
  if (max && ritmo > max + tolerancia) return 'lento'
  if (min && ritmo < min - tolerancia) return 'rapido'
  return 'en_rango'
}

// Pulso real contra el objetivo. Con un solo valor, es un tope ("hasta 130").
export type EnRangoFc = 'en_rango' | 'alto' | 'bajo' | null
export function compararFc(fc: number | null, min: number | null, max: number | null, tolerancia = 3): EnRangoFc {
  if (!fc || (!min && !max)) return null
  const tope = max ?? min!
  if (fc > tope + tolerancia) return 'alto'
  if (min && max && min !== max && fc < min - tolerancia) return 'bajo'
  return 'en_rango'
}

// ---------- Estado de cada día (cuadritos) ----------

export type EstadoDia = Resultado | 'por_evaluar' | 'sin_registro' | 'hoy' | 'futuro' | 'descanso' | 'sin_plan'

export const TEXTO_ESTADO: Record<EstadoDia, string> = {
  cumplio: 'Cumplió',
  parcial: 'Parcial',
  no_cumplio: 'No cumplió',
  por_evaluar: 'Por evaluar',
  sin_registro: 'Sin registro',
  hoy: 'Hoy, pendiente',
  futuro: 'Próximo',
  descanso: 'Descanso',
  sin_plan: 'Sin plan',
}

export function estadoDia(sesiones: SesionCompleta[], fecha: string, hoy: string, hayPlan: boolean): EstadoDia {
  if (!hayPlan) return 'sin_plan'
  const activas = sesiones.filter((s) => s.fecha === fecha && s.tipo !== 'descanso')
  if (!activas.length) return 'descanso'
  if (activas.some((s) => s.registro && !s.evaluacion)) return 'por_evaluar'
  const resultados = activas.map((s) => s.evaluacion?.resultado).filter(Boolean) as Resultado[]
  if (resultados.length) {
    if (resultados.every((r) => r === 'cumplio')) return 'cumplio'
    if (resultados.every((r) => r === 'no_cumplio')) return 'no_cumplio'
    return 'parcial'
  }
  if (fecha < hoy) return 'sin_registro'
  if (fecha === hoy) return 'hoy'
  return 'futuro'
}

// ---------- Alertas ----------

/** Recibe las semanas recientes de UN alumno (al menos las 2 últimas). */
export function alertasAlumno(semanas: SemanaCompleta[], hoy: string): string[] {
  const alertas: string[] = []
  const sesiones = semanas.flatMap((s) => s.sesiones).filter((s) => s.tipo !== 'descanso')
  const pasadas = sesiones.filter((s) => s.fecha < hoy && s.fecha >= sumarDias(hoy, -14))

  // Sin registros hace 3 o más días (con sesiones planificadas en ese lapso).
  const registros = sesiones.filter((s) => s.registro).map((s) => s.registro!.fecha).sort()
  const ultimo = registros[registros.length - 1]
  const desde = ultimo ?? sumarDias(hoy, -14)
  const diasSin = diasEntre(desde, hoy)
  const planeadasDesde = pasadas.filter((s) => s.fecha > desde && !s.registro).length
  if (diasSin >= 3 && planeadasDesde > 0) {
    alertas.push(ultimo ? `Sin registros ${haceDias(diasSin)}` : 'Sin registros en las últimas 2 semanas')
  }

  // Cumplimiento bajo en las últimas 2 semanas.
  if (pasadas.length >= 3) {
    const pct = Math.round((100 * pasadas.filter((s) => s.registro).length) / pasadas.length)
    if (pct < 60) alertas.push(`Cumplimiento bajo: ${pct}% en 2 semanas`)
  }

  // Ritmo fuera de rango en las últimas sesiones.
  const conRango = sesiones
    .filter((s) => s.registro && (s.ritmo_min_seg || s.ritmo_max_seg))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 5)
  const fuera = conRango.filter((s) => {
    const c = compararRitmo(s.registro!.ritmo_prom_seg, s.ritmo_min_seg, s.ritmo_max_seg, 10)
    return c === 'lento' || c === 'rapido'
  })
  if (conRango.length >= 3 && fuera.length >= 2) {
    const lentas = fuera.filter((s) => compararRitmo(s.registro!.ritmo_prom_seg, s.ritmo_min_seg, s.ritmo_max_seg, 10) === 'lento').length
    alertas.push(`Ritmo fuera de rango en ${fuera.length} de las últimas ${conRango.length} sesiones (${lentas >= fuera.length / 2 ? 'más lento' : 'más rápido'})`)
  }

  return alertas
}

// ---------- Cuotas ----------

export const estaVencida = (c: Cuota, hoy: string) => c.estado === 'pendiente' && c.vencimiento < hoy

export function estadoDeuda(cuotas: Cuota[], hoy: string) {
  const vencidas = cuotas.filter((c) => estaVencida(c, hoy)).sort((a, b) => a.periodo.localeCompare(b.periodo))
  const total = vencidas.reduce((t, c) => t + c.monto, 0)
  const dias = vencidas.length ? diasEntre(vencidas[0].vencimiento, hoy) : 0
  let texto = 'Cuota al día'
  if (vencidas.length === 1) texto = `${nombreMes(vencidas[0].periodo)} vencida ${haceDias(dias)}`
  if (vencidas.length > 1) texto = `${vencidas.length} cuotas vencidas · ${dias} días`
  const titulo = vencidas.length
    ? `Debe ${vencidas.length} cuota${vencidas.length > 1 ? 's' : ''} · ${formatoGs(total)}`
    : 'Cuota al día'
  return { vencidas, total, dias, texto, titulo }
}

// Cuotas pendientes (de la más vieja a la más nueva) que cubre un monto.
export function cuotasQueCubre(pendientes: Cuota[], monto: number): Cuota[] {
  const elegidas: Cuota[] = []
  let resto = monto
  for (const c of [...pendientes].sort((a, b) => a.periodo.localeCompare(b.periodo))) {
    if (c.monto > resto) break
    elegidas.push(c)
    resto -= c.monto
  }
  return elegidas
}

// ---------- Ciclo menstrual (estimación orientativa) ----------

export type Fase = 'menstrual' | 'folicular' | 'ovulatoria' | 'lútea'

export function estimarCiclo(inicios: string[], fecha: string) {
  const previos = [...inicios].filter((i) => i <= fecha).sort().reverse()
  if (!previos.length) return null
  const difs: number[] = []
  for (let i = 0; i < Math.min(previos.length - 1, 6); i++) {
    const d = diasEntre(previos[i + 1], previos[i])
    if (d >= 18 && d <= 45) difs.push(d)
  }
  const duracion = difs.length ? Math.round(difs.reduce((a, b) => a + b, 0) / difs.length) : 28
  const dia = diasEntre(previos[0], fecha) + 1
  const ovulacion = duracion - 14
  const fase: Fase = dia <= 5 ? 'menstrual' : dia < ovulacion - 1 ? 'folicular' : dia <= ovulacion + 1 ? 'ovulatoria' : 'lútea'
  const proximo = sumarDias(previos[0], duracion)
  return { dia, fase, duracion, proximo, atrasado: proximo < fecha }
}

// ---------- WhatsApp ----------

export function textoWhatsApp(sesiones: SesionPlan[], lunes: string, nombresTipo: Record<string, string>, nota?: string | null) {
  const lineas = diasDeSemana(lunes).map((fecha) => {
    const delDia = sesiones.filter((s) => s.fecha === fecha).sort((a, b) => a.turno - b.turno)
    const nombre = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][diaSemana(fecha)]
    if (!delDia.length) return `${nombre}: descanso`
    const partes = delDia.map((s) => {
      const base = s.resumen?.trim() || nombresTipo[s.tipo] || s.tipo
      const min = s.ritmo_min_seg, max = s.ritmo_max_seg
      const mmss = (x: number) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`
      const rango = min && max ? ` (${mmss(min)}–${mmss(max)})` : min || max ? ` (${mmss((min ?? max)!)})` : ''
      const fcMin = s.fc_obj_min, fcMax = s.fc_obj_max
      const pulso = fcMin && fcMax && fcMin !== fcMax ? ` ❤${fcMin}–${fcMax} ppm` : fcMin || fcMax ? ` ❤${fcMax ?? fcMin} ppm` : ''
      return base + rango + pulso
    })
    return `${nombre}: ${partes.join(' / ')}`
  })
  return (nota?.trim() ? `${nota.trim()}\n\n` : '') + lineas.join('\n')
}
