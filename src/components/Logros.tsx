import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { hoyPY, lunesDe, sumarDias } from '../lib/fechas'
import { formatoKm } from '../lib/formato'
import { Cargando, Tarjeta, Titulo } from './ui'

type Logro = { icono: string; nombre: string; detalle: string; logrado: boolean; progreso?: string }

type Datos = {
  sesiones: { fecha: string; distancia_km: number | null }[]
  semanas: { semana_inicio: string; sesiones_plan: number; cumplimiento_pct: number | null }[]
  carreras: { resultado_tiempo_seg: number | null; tiempo_objetivo_seg: number | null }[]
  asistencias: number
}

// Racha: semanas cerradas seguidas cumpliendo el 80% o más del plan.
function rachas(semanas: Datos['semanas']) {
  const lunes = lunesDe(hoyPY())
  const cerradas = semanas.filter((s) => s.semana_inicio < lunes && s.sesiones_plan > 0).sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio))
  let mejor = 0
  let actual = 0
  let anterior: string | null = null
  for (const s of cerradas) {
    const cumplio = (s.cumplimiento_pct ?? 0) >= 80
    const seguida = anterior !== null && sumarDias(anterior, 7) === s.semana_inicio
    actual = cumplio ? (seguida ? actual + 1 : 1) : 0
    mejor = Math.max(mejor, actual)
    anterior = s.semana_inicio
  }
  // La racha actual se corta si la última semana cerrada no es la anterior a esta.
  const ultima = cerradas[cerradas.length - 1]
  if (!ultima || sumarDias(ultima.semana_inicio, 7) !== lunes) actual = 0
  return { actual, mejor }
}

export function calcularLogros(d: Datos) {
  const n = d.sesiones.length
  const km = d.sesiones.reduce((t, s) => t + (s.distancia_km ?? 0), 0)
  const largo = Math.max(0, ...d.sesiones.map((s) => s.distancia_km ?? 0))
  const corridas = d.carreras.filter((c) => c.resultado_tiempo_seg)
  const objetivo = corridas.some((c) => c.tiempo_objetivo_seg && c.resultado_tiempo_seg! <= c.tiempo_objetivo_seg)
  const r = rachas(d.semanas)
  const L = (icono: string, nombre: string, detalle: string, logrado: boolean, progreso?: string): Logro => ({ icono, nombre, detalle, logrado, progreso })
  return {
    racha: r,
    km,
    n,
    logros: [
      L('👟', 'Primer paso', 'Registraste tu primera sesión', n >= 1),
      L('🔟', 'Constancia', '10 sesiones registradas', n >= 10, `${Math.min(n, 10)}/10`),
      L('💯', 'Centenario', '100 sesiones registradas', n >= 100, `${Math.min(n, 100)}/100`),
      L('📏', '100 km', 'Sumaste 100 km', km >= 100, `${formatoKm(Math.min(km, 100))}/100`),
      L('🚀', '500 km', 'Sumaste 500 km', km >= 500, `${formatoKm(Math.min(km, 500))}/500`),
      L('🌎', '1.000 km', 'Sumaste 1.000 km', km >= 1000, `${formatoKm(Math.min(km, 1000))}/1.000`),
      L('🔥', 'Racha de 4', '4 semanas seguidas cumpliendo el plan (80%+)', r.mejor >= 4, `${Math.min(r.mejor, 4)}/4`),
      L('⚡', 'Racha de 12', '12 semanas seguidas cumpliendo el plan', r.mejor >= 12, `${Math.min(r.mejor, 12)}/12`),
      L('🌅', 'Fondista', 'Una sesión de 21 km o más', largo >= 21),
      L('🏁', 'A la cancha', 'Corriste tu primera carrera', corridas.length >= 1),
      L('🎯', 'Objetivo cumplido', 'Bajaste tu tiempo objetivo en una carrera', objetivo),
      L('📍', 'Presente', '10 entrenamientos grupales', d.asistencias >= 10, `${Math.min(d.asistencias, 10)}/10`),
    ],
  }
}

/** Rachas y logros de un alumno (lo ven el alumno y el entrenador). */
export function Logros({ alumnoId }: { alumnoId: string }) {
  const [d, setD] = useState<Datos | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('sesiones_registradas').select('fecha, distancia_km').eq('alumno_id', alumnoId),
      supabase.from('v_resumen_semanal').select('semana_inicio, sesiones_plan, cumplimiento_pct').eq('alumno_id', alumnoId),
      supabase.from('competencias').select('resultado_tiempo_seg, tiempo_objetivo_seg').eq('alumno_id', alumnoId).eq('estado', 'aprobada'),
      supabase.from('asistencias').select('alumno_id', { count: 'exact', head: true }).eq('alumno_id', alumnoId),
    ]).then(([s, v, c, a]) =>
      setD({
        sesiones: ((s.data ?? []) as Datos['sesiones']).map((x) => ({ ...x, distancia_km: x.distancia_km === null ? null : Number(x.distancia_km) })),
        semanas: (v.data ?? []) as Datos['semanas'],
        carreras: (c.data ?? []) as Datos['carreras'],
        asistencias: a.count ?? 0,
      }),
    )
  }, [alumnoId])

  if (!d) return <Cargando />
  const { racha, logros, km, n } = calcularLogros(d)
  const conseguidos = logros.filter((l) => l.logrado).length

  return (
    <Tarjeta>
      <Titulo>🏅 Rachas y logros</Titulo>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-fondo p-2">
          <p className="font-titulo text-2xl font-extrabold text-azul">🔥 {racha.actual}</p>
          <p className="text-xs text-texto-2">semanas seguidas</p>
        </div>
        <div className="rounded-xl bg-fondo p-2">
          <p className="font-titulo text-2xl font-extrabold">{n}</p>
          <p className="text-xs text-texto-2">sesiones</p>
        </div>
        <div className="rounded-xl bg-fondo p-2">
          <p className="font-titulo text-2xl font-extrabold">{formatoKm(km)}</p>
          <p className="text-xs text-texto-2">km totales</p>
        </div>
      </div>
      {racha.mejor > racha.actual && <p className="mb-2 text-sm text-texto-2">Tu mejor racha: {racha.mejor} semanas.</p>}
      <p className="mb-2 text-sm font-semibold">
        {conseguidos} de {logros.length} logros
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {logros.map((l) => (
          <li
            key={l.nombre}
            title={l.detalle}
            className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 text-center ${l.logrado ? 'border-azul/40 bg-azul/10' : 'border-borde opacity-55 grayscale'}`}
          >
            <span className="text-2xl" aria-hidden="true">
              {l.icono}
            </span>
            <span className="text-xs font-semibold leading-tight">{l.nombre}</span>
            <span className="text-[0.65rem] leading-tight text-texto-2">{l.logrado ? '✓ Logrado' : (l.progreso ?? 'Pendiente')}</span>
            <span className="sr-only">{l.detalle}</span>
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
