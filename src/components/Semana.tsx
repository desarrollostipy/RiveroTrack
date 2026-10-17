import { useEffect, useState } from 'react'
import { cargarTipos } from '../lib/consultas'
import { estadoDia, TEXTO_ESTADO, type EstadoDia } from '../lib/calculos'
import { DIAS, DIAS_CORTOS, diasDeSemana } from '../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRango, formatoRitmo } from '../lib/formato'
import type { SesionCompleta, TipoSesion } from '../lib/tipos'
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
  parcial: 'bg-parcial text-marino border-parcial',
  no_cumplio: 'bg-mal text-white border-mal',
  por_evaluar: 'bg-white text-azul border-azul border-2',
  sin_registro: 'bg-mal/15 text-mal border-mal/30',
  hoy: 'bg-white text-marino border-marino border-2',
  futuro: 'bg-borde/70 text-texto-2 border-borde',
  descanso: 'bg-white text-texto-2/60 border-dashed border-borde',
  sin_plan: 'bg-white text-texto-2/50 border-dashed border-borde',
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

/** Lo que hizo el alumno, en una línea: ✓ 12,1 km · 5:24/km */
export function TextoRegistro({ s }: { s: SesionCompleta }) {
  const r = s.registro
  if (!r) return null
  const partes = [
    r.distancia_km ? `${formatoKm(r.distancia_km)} km` : null,
    r.ritmo_prom_seg ? `${formatoRitmo(r.ritmo_prom_seg)}/km` : null,
    !r.distancia_km && r.duracion_seg ? formatoDuracion(r.duracion_seg) : null,
  ].filter(Boolean)
  return <span className="font-mono text-sm text-ok">✓ {partes.join(' · ') || 'Registrada'}</span>
}

/** Lista de días de una semana con sus sesiones. */
export function ListaDias({
  lunes,
  sesiones,
  hoy,
  accion,
  extra,
}: {
  lunes: string
  sesiones: SesionCompleta[]
  hoy: string
  accion?: (s: SesionCompleta) => React.ReactNode
  extra?: (s: SesionCompleta) => React.ReactNode
}) {
  const { tipo } = useTipos()
  return (
    <ul className="flex flex-col gap-2">
      {diasDeSemana(lunes).map((fecha, i) => {
        const delDia = sesiones.filter((s) => s.fecha === fecha)
        const esHoy = fecha === hoy
        return (
          <li key={fecha} className={`rounded-2xl border bg-white p-3 ${esHoy ? 'border-azul ring-2 ring-azul/20' : 'border-borde'}`}>
            <p className="mb-1 text-sm font-semibold">
              {DIAS[i]} <span className="font-normal text-texto-2">{formatoFecha(fecha)}</span>
              {esHoy && <span className="ml-2 rounded-full bg-azul px-2 py-0.5 text-xs text-white">Hoy</span>}
            </p>
            {delDia.length === 0 && <p className="text-sm text-texto-2">Descanso</p>}
            <div className="flex flex-col divide-y divide-borde">
              {delDia.map((s) => {
                const t = tipo(s.tipo)
                return (
                  <div key={s.id} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {delDia.length > 1 && <span className="text-xs text-texto-2">{s.turno === 1 ? 'Mañana' : 'Tarde'}</span>}
                      <EtiquetaTipo nombre={t.nombre} color={t.color} />
                      <span className="font-semibold">{s.resumen || t.nombre}</span>
                      {(s.ritmo_min_seg || s.ritmo_max_seg) && (
                        <span className="font-mono text-sm text-texto-2">{formatoRango(s.ritmo_min_seg, s.ritmo_max_seg)}/km</span>
                      )}
                    </div>
                    {s.estructura && <p className="text-sm text-texto-2">{s.estructura}</p>}
                    {s.notas && <p className="text-sm text-texto-2">📝 {s.notas}</p>}
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
          </li>
        )
      })}
    </ul>
  )
}
