// Carga acumulada: km corridos desde la última descarga muscular (fisio, masaje),
// contra un límite que pone el entrenador para cada alumno. Sirve para recomendar
// la descarga a tiempo, antes de que aparezcan las molestias.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { notificar } from './push'
import { formatoKm } from './formato'

export const UMBRAL_BASE = 150
export const UMBRALES = [100, 150, 200, 250, 300]

export type TipoDescarga = 'fisio' | 'masaje' | 'otra'
export const TIPOS_DESCARGA: { valor: TipoDescarga; texto: string }[] = [
  { valor: 'fisio', texto: '🩺 Fisio' },
  { valor: 'masaje', texto: '💆 Masaje' },
  { valor: 'otra', texto: '✨ Otra' },
]

export type Descarga = {
  id: string
  alumno_id: string
  fecha: string
  estado: 'hecha' | 'recomendada'
  tipo: TipoDescarga | null
  nota: string | null
  km: number | null
  created_at: string
}

export type Carga = {
  alumno_id: string
  umbral_km: number
  ultima_descarga: string | null
  desde: string
  km: number
  recomendada_el: string | null
}

export type NivelCarga = 'sin_dato' | 'ok' | 'cerca' | 'toca'
export const NIVEL: Record<NivelCarga, { texto: string; color: string }> = {
  sin_dato: { texto: 'Sin registro', color: 'var(--color-texto-2)' },
  ok: { texto: 'Bien', color: 'var(--color-ok)' },
  cerca: { texto: 'Se acerca', color: '#F2B544' },
  toca: { texto: 'Toca descarga', color: '#FF6B6B' },
}

/**
 * Verde hasta el 75 % del límite, amarillo hasta el 100 %, rojo desde ahí.
 * Sin ninguna descarga registrada no se sabe desde cuándo contar: queda en gris
 * (se muestran los km de las últimas 4 semanas solo como referencia).
 */
export function estadoCarga(c: Pick<Carga, 'km' | 'umbral_km' | 'ultima_descarga'>) {
  const pct = c.umbral_km ? Number(c.km) / c.umbral_km : 0
  const nivel: NivelCarga = !c.ultima_descarga ? 'sin_dato' : pct >= 1 ? 'toca' : pct >= 0.75 ? 'cerca' : 'ok'
  return { pct, nivel, faltan: Math.max(0, c.umbral_km - Number(c.km)), ...NIVEL[nivel] }
}

const normalizar = (x: Carga): Carga => ({ ...x, km: Number(x.km), umbral_km: Number(x.umbral_km) })

/** Carga de todos los alumnos activos (el entrenador) o la propia (el alumno). Null si falta el SQL. */
export async function cargarCargas(alumnoId?: string): Promise<Carga[] | null> {
  let q = supabase.from('v_carga_acumulada').select('*')
  if (alumnoId) q = q.eq('alumno_id', alumnoId)
  const { data, error } = await q
  if (error) return null
  return ((data ?? []) as Carga[]).map(normalizar)
}

/** Carga e historial de descargas de un alumno. `listo` = false mientras carga; carga null si falta el SQL. */
export function useCarga(alumnoId: string) {
  const [carga, setCarga] = useState<Carga | null>(null)
  const [historial, setHistorial] = useState<Descarga[]>([])
  const [listo, setListo] = useState(false)
  const recargar = useCallback(async () => {
    const [c, h] = await Promise.all([
      cargarCargas(alumnoId),
      supabase.from('descargas').select('*').eq('alumno_id', alumnoId).order('fecha', { ascending: false }).order('created_at', { ascending: false }).limit(12),
    ])
    setCarga(c?.[0] ?? null)
    setHistorial((h.data ?? []) as Descarga[])
    setListo(true)
  }, [alumnoId])
  useEffect(() => {
    recargar()
  }, [recargar])
  return { carga, historial, listo, recargar }
}

/** El entrenador recomienda la descarga: queda marcada y le llega un mensaje al chat del alumno. */
export async function recomendarDescarga(alumnoId: string, nombre: string, c: Carga | null) {
  const { error } = await supabase.from('descargas').insert({ alumno_id: alumnoId, estado: 'recomendada', km: c ? Math.round(c.km * 10) / 10 : null })
  if (error) return error
  const texto = `💆 ${nombre.split(' ')[0]}, te recomiendo hacer una descarga muscular con la fisio${
    c ? `: llevás ${formatoKm(c.km)} km ${c.ultima_descarga ? 'desde la última' : 'en las últimas 4 semanas'}` : ''
  }. Cuando la hagas, marcala en la app (Mi salud → Carga).`
  const m = await supabase.from('mensajes').insert({ alumno_id: alumnoId, texto })
  if (!m.error) notificar({ tipo: 'mensaje', alumno_id: alumnoId, texto })
  return null
}

/** Registrar una descarga hecha: desde ahí, los km vuelven a cero. */
export async function registrarDescarga(d: { alumno_id: string; fecha: string; tipo: TipoDescarga; nota: string; km: number | null }) {
  const { error } = await supabase.from('descargas').insert({ ...d, estado: 'hecha', nota: d.nota.trim() || null })
  return error
}

/** Cambiar el límite de km de uno o varios alumnos (solo el entrenador). */
export async function cambiarUmbral(alumnoIds: string[], km: number) {
  const { error } = await supabase.from('alumnos').update({ km_descarga: km === UMBRAL_BASE ? null : km }).in('id', alumnoIds)
  return error
}
