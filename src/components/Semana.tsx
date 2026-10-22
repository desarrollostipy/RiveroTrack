import { textoReps, textoTiempo } from '../lib/intervalos'
import type { ActividadExtra } from '../lib/extras'
import { ChipExtra } from './ActividadesExtra'
import { kmCorridos } from '../lib/extras'
import { useEffect, useState } from 'react'
import { cargarTipos } from '../lib/consultas'
import { estadoDia, TEXTO_ESTADO, type EstadoDia } from '../lib/calculos'
import { DIAS, DIAS_CORTOS, diasDeSemana } from '../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoPpm, formatoRango, formatoRitmo } from '../lib/formato'
import type { SesionCompleta, SesionPlan, TipoSesion } from '../lib/tipos'
import { EtiquetaTipo, Semaforo } from './ui'

export function useTipos() {
  const [tipos, setTipos] = useState<TipoSesion[]>([])
  useEffect(() => {
    cargarTipos().then(setTipos)
  }, [])
  const porCodigo = Object.fromEntries(tipos.map((t) => [t.codigo, t]))
  const tipo = (codigo: string) => porCodigo[codigo] ?? { codigo, nombre: codigo, color: '#76819A', orden: 99 }
  return { tipos, tipo }
}

const ESTILO_CUADRO: Record<EstadoDia, string> = {
  cumplio: 'bg-ok text-white border-ok',
  parcial: 'bg-parcial text-[#0B1B3A] border-parcial',
  no_cumplio: 'bg-mal text-white border-mal',
  por_evaluar: 'bg-superficie text-azul border-azul border-2',
  sin_registro: 'bg-mal/15 text-mal border-mal/30',
  hoy: 'bg-superficie text-tinta border-marino border-2',
  futuro: 'bg-borde/70 text-texto-2 border-borde',
  descanso: 'bg-superficie text-texto-2/60 border-dashed border-borde',
  sin_plan: 'bg-superficie text-texto-2/50 border-dashed border-borde',
}

/** Fila de 7 cuadritos, uno por día, con su estado. */
export function CuadritosSemana({ sesiones, lunes, hoy, hayPlan }: { sesiones: SesionCompleta[]; lunes: string; hoy: string; hayPlan: boolean }) {
  return (
    <ol className="flex gap-1" aria-label="Estado de la semana">
      {diasDeSemana(lunes).map((fecha, i) => {
        const estado = estadoDia(sesiones, fecha, hoy, hayPlan)
        return (
          <li
            key={fecha}
            title={`${DIAS[i]}: ${TEXTO_ESTADO[estado]}`}
            className={`flex h-8 flex-1 items-center justify-center rounded-md border text-xs font-bold ${ESTILO_CUADRO[estado]}`}
          >
            <span aria-hidden="true">{DIAS_CORTOS[i]}</span>
            <span className="sr-only">
              {DIAS[i]}: {TEXTO_ESTADO[estado]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export function LeyendaCuadritos() {
  const items: EstadoDia[] = ['cumplio', 'parcial', 'no_cumplio', 'por_evaluar', 'sin_registro', 'futuro', 'descanso']
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-texto-2">
      {items.map((e) => (
        <li key={e} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded-sm border ${ESTILO_CUADRO[e]}`} aria-hidden="true" />
          {TEXTO_ESTADO[e]}
        </li>
      ))}
    </ul>
  )
}

/**
 * Resumen completo de lo que indicó el entrenador:
 * 📏 10 km · ⏱ 60 min · ⚡ 5:50–6:05 /km · ❤ 125–135 ppm, más estructura y notas.
 */
export function ObjetivosSesion({ s, grande = false, sinNotas = false }: { s: SesionPlan; grande?: boolean; sinNotas?: boolean }) {
  if (s.tipo === 'descanso') return s.notas && !sinNotas ? <p className="text-sm text-texto-2">📝 {s.notas}</p> : null
  const items: { icono: string; texto: string; etiqueta: string; clase?: string }[] = []
  const reps = textoReps(s)
  if (reps) items.push({ icono: '🔁', texto: reps, etiqueta: 'Repeticiones' })
  if (s.distancia_km) items.push({ icono: '📏', texto: `${formatoKm(s.distancia_km)} km`, etiqueta: 'Distancia' })
  if (s.duracion_min) items.push({ icono: '⏱', texto: `${s.duracion_min} min`, etiqueta: 'Duración' })
  if (s.ritmo_min_seg || s.ritmo_max_seg) items.push({ icono: '⚡', texto: `${formatoRango(s.ritmo_min_seg, s.ritmo_max_seg)} /km`, etiqueta: 'Ritmo' })
  if (s.fc_obj_min || s.fc_obj_max) {
    const rango = s.fc_obj_min && s.fc_obj_max && s.fc_obj_min !== s.fc_obj_max
    items.push({ icono: '❤', texto: `${rango ? '' : 'hasta '}${formatoPpm(s.fc_obj_min, s.fc_obj_max)}`, etiqueta: 'Pulso', clase: 'text-mal' })
  }
  return (
    <div className="flex flex-col gap-1.5">
      {items.length > 0 && (
        <ul className={`flex flex-wrap gap-1.5 ${grande ? 'text-base' : 'text-sm'}`}>
          {items.map((it) => (
            <li key={it.etiqueta} className={`rounded-lg bg-fondo px-2 py-1 font-mono ${it.clase ?? ''}`} title={it.etiqueta}>
              <span aria-hidden="true">{it.icono}</span> <span className="sr-only">{it.etiqueta}:</span>
              {it.texto}
            </li>
          ))}
        </ul>
      )}
      {s.estructura && s.estructura !== reps && <p className={`${grande ? 'text-base' : 'text-sm'} text-tinta`}>{s.estructura}</p>}
      {s.notas && !sinNotas && <p className="rounded-xl bg-azul/5 px-3 py-2 text-sm">📝 {s.notas}</p>}
    </div>
  )
}

/** Lo que hizo el alumno, en una línea: ✓ 12,1 km · 5:24/km */
export function TextoRegistro({ s }: { s: SesionCompleta }) {
  const r = s.registro
  if (!r) return null
  const partes = [
    r.reps_hechas && s.reps ? `${r.reps_hechas}/${s.reps} rep.` : null,
    r.rep_prom_seg ? `vuelta ${textoTiempo(r.rep_prom_seg)}` : null,
    r.distancia_km ? `${formatoKm(r.distancia_km)} km` : null,
    r.ritmo_prom_seg ? `${formatoRitmo(r.ritmo_prom_seg)}/km` : null,
    !r.distancia_km && r.duracion_seg ? formatoDuracion(r.duracion_seg) : null,
    kmCorridos(r) > Number(r.distancia_km ?? 0) ? `total ${formatoKm(kmCorridos(r))} km` : null,
  ].filter(Boolean)
  return <span className="font-mono text-sm text-ok">✓ {partes.join(' · ') || 'Registrada'}</span>
}

/**
 * Lista de días de una semana con sus sesiones y las actividades extra.
 * Con `onAgregarExtra` (alumno) aparece "+ Actividad extra" en los días hasta hoy.
 */
export function ListaDias({
  lunes,
  sesiones,
  hoy,
  accion,
  extra,
  extras = [],
  onAgregarExtra,
  onBorrarExtra,
}: {
  lunes: string
  sesiones: SesionCompleta[]
  hoy: string
  accion?: (s: SesionCompleta) => React.ReactNode
  extra?: (s: SesionCompleta) => React.ReactNode
  extras?: ActividadExtra[]
  onAgregarExtra?: (fecha: string) => void
  onBorrarExtra?: (a: ActividadExtra) => void
}) {
  const { tipo } = useTipos()
  return (
    <ul className="flex flex-col gap-2">
      {diasDeSemana(lunes).map((fecha, i) => {
        const delDia = sesiones.filter((s) => s.fecha === fecha)
        const extrasDia = extras.filter((x) => x.fecha === fecha)
        const esHoy = fecha === hoy
        return (
          <li key={fecha} className={`rounded-2xl border bg-superficie p-3 ${esHoy ? 'border-azul ring-2 ring-azul/20' : 'border-borde'}`}>
            <p className="mb-1 text-sm font-semibold">
              {DIAS[i]} <span className="font-normal text-texto-2">{formatoFecha(fecha)}</span>
              {esHoy && <span className="ml-2 rounded-full bg-azul px-2 py-0.5 text-xs text-white">Hoy</span>}
            </p>
            {delDia.length === 0 && extrasDia.length === 0 && <p className="text-sm text-texto-2">Descanso</p>}
            <div className="flex flex-col divide-y divide-borde">
              {delDia.map((s) => {
                const t = tipo(s.tipo)
                return (
                  <div key={s.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {delDia.length > 1 && <span className="text-xs text-texto-2">{s.turno === 1 ? 'Mañana' : 'Tarde'}</span>}
                      <EtiquetaTipo nombre={t.nombre} color={t.color} />
                      <span className="font-semibold">{s.resumen || t.nombre}</span>
                    </div>
                    <ObjetivosSesion s={s} />
                    {s.tipo !== 'descanso' && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {s.registro ? <TextoRegistro s={s} /> : fecha < hoy ? <span className="text-sm text-mal">Sin registro</span> : null}
                          {s.evaluacion && <Semaforo resultado={s.evaluacion.resultado} />}
                        </div>
                        {accion?.(s)}
                      </div>
                    )}
                    {extra?.(s)}
                  </div>
                )
              })}
            </div>
            {extrasDia.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {extrasDia.map((x) => (
                  <ChipExtra key={x.id} a={x} onBorrar={onBorrarExtra ? () => onBorrarExtra(x) : undefined} />
                ))}
              </div>
            )}
            {onAgregarExtra && fecha <= hoy && (
              <button type="button" onClick={() => onAgregarExtra(fecha)} className="mt-2 min-h-9 text-sm font-semibold text-[#0F6E78]">
                + Actividad extra
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
