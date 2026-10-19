import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/consultas'
import { diasEntre, hoyPY } from '../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRitmo, leerDuracion, leerNumero } from '../lib/formato'
import type { Competencia } from '../lib/tipos'
import { AreaTexto, Boton, Campo, MensajeError } from './ui'

// Piezas compartidas entre el entrenador y el alumno para las competencias.

const ESTADO = {
  propuesta: { texto: 'Esperando aprobación', clase: 'bg-parcial text-marino' },
  aprobada: { texto: 'Aprobada', clase: 'bg-ok text-white' },
  rechazada: { texto: 'No aprobada', clase: 'bg-mal text-white' },
} as const

export function EstadoCompetencia({ c }: { c: Competencia }) {
  const e = ESTADO[c.estado]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${e.clase}`}>{e.texto}</span>
}

// Marca oficial que corresponde a la distancia (5K, 10K, 21K, 42K) o null.
export function distanciaMarca(km: number | null): '5K' | '10K' | '21K' | '42K' | null {
  if (!km) return null
  if (Math.abs(km - 5) < 0.15) return '5K'
  if (Math.abs(km - 10) < 0.2) return '10K'
  if (Math.abs(km - 21.1) < 0.3) return '21K'
  if (Math.abs(km - 42.2) < 0.4) return '42K'
  return null
}

/** Datos de una competencia: fecha, distancia, objetivo, comentarios y resultado. */
export function DetalleCompetencia({ c, nombreAlumno, children }: { c: Competencia; nombreAlumno?: string; children?: ReactNode }) {
  const hoy = hoyPY()
  const faltan = diasEntre(hoy, c.fecha)
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-borde bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {nombreAlumno && <p className="text-sm font-semibold text-azul">{nombreAlumno}</p>}
          <p className="font-semibold">{c.nombre}</p>
          <p className="text-sm text-texto-2">
            {formatoFecha(c.fecha)}/{c.fecha.slice(2, 4)}
            {c.distancia_km ? ` · ${formatoKm(c.distancia_km)} km` : ''}
            {c.lugar ? ` · ${c.lugar}` : ''}
            {c.tiempo_objetivo_seg ? ` · objetivo ${formatoDuracion(c.tiempo_objetivo_seg)}` : ''}
          </p>
        </div>
        {faltan >= 0 && c.estado !== 'rechazada' ? (
          <p className="shrink-0 text-right">
            <span className="font-titulo text-2xl font-extrabold text-azul">{faltan}</span>
            <span className="block text-xs text-texto-2">{faltan === 1 ? 'día' : 'días'}</span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <EstadoCompetencia c={c} />
        {c.propuesta_por === 'alumno' && <span className="rounded-full border border-borde px-2.5 py-0.5 text-xs text-texto-2">Propuesta por el alumno</span>}
      </div>
      {c.comentario_alumno && <p className="rounded-xl bg-fondo px-3 py-2 text-sm">🏃 “{c.comentario_alumno}”</p>}
      {c.comentario_entrenador && <p className="rounded-xl bg-azul/10 px-3 py-2 text-sm">💬 Profe: “{c.comentario_entrenador}”</p>}
      {c.resultado_tiempo_seg && (
        <div className="rounded-xl bg-ok/10 px-3 py-2 text-sm">
          <p className="font-semibold text-ok">
            🏁 {formatoDuracion(c.resultado_tiempo_seg)}
            {c.distancia_km ? ` · ${formatoRitmo(c.resultado_tiempo_seg / c.distancia_km)}/km` : ''}
            {c.resultado_posicion ? ` · ${c.resultado_posicion}` : ''}
          </p>
          {c.tiempo_objetivo_seg && (
            <p className="text-texto-2">
              {c.resultado_tiempo_seg <= c.tiempo_objetivo_seg
                ? `¡Objetivo cumplido! (${formatoDuracion(c.tiempo_objetivo_seg - c.resultado_tiempo_seg)} menos)`
                : `${formatoDuracion(c.resultado_tiempo_seg - c.tiempo_objetivo_seg)} sobre el objetivo`}
            </p>
          )}
          {c.resultado_comentario && <p className="text-marino">“{c.resultado_comentario}”</p>}
          {c.resultado_link && (
            <a href={c.resultado_link} target="_blank" rel="noreferrer" className="font-semibold text-azul underline">
              Ver actividad / resultados ↗
            </a>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

/** Cargar el resultado (alumno o entrenador). */
export function FormResultado({ c, onListo, onCancelar }: { c: Competencia; onListo: () => void; onCancelar: () => void }) {
  const [tiempo, setTiempo] = useState(c.resultado_tiempo_seg ? formatoDuracion(c.resultado_tiempo_seg) : '')
  const [posicion, setPosicion] = useState(c.resultado_posicion ?? '')
  const [comentario, setComentario] = useState(c.resultado_comentario ?? '')
  const [link, setLink] = useState(c.resultado_link ?? '')
  const [error, setError] = useState('')

  async function guardar() {
    const seg = leerDuracion(tiempo)
    if (!seg) return setError('Ingresá el tiempo, por ejemplo 48:30 o 1:42:10.')
    const linkLimpio = link.match(/https?:\/\/\S+/)?.[0] ?? null
    const { error } = await supabase.rpc('cargar_resultado_competencia', {
      p_competencia_id: c.id,
      p_tiempo_seg: seg,
      p_posicion: posicion,
      p_comentario: comentario,
      p_link: linkLimpio,
    })
    if (error) return setError(mensajeError(error))
    onListo()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-azul/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo id={`res-t-${c.id}`} label="Tiempo final" placeholder="48:30" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        <Campo id={`res-p-${c.id}`} label="Posición (opcional)" placeholder="15° general" value={posicion} onChange={(e) => setPosicion(e.target.value)} />
      </div>
      <Campo id={`res-l-${c.id}`} label="Link de Garmin o resultados (opcional)" value={link} onChange={(e) => setLink(e.target.value)} />
      <AreaTexto id={`res-c-${c.id}`} label="¿Cómo te fue? (opcional)" rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        <Boton variante="borde" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton className="flex-1" onClick={guardar}>
          Guardar resultado
        </Boton>
      </div>
    </div>
  )
}

/** El entrenador aprueba o no una competencia propuesta. */
export function RevisarCompetencia({ c, onListo }: { c: Competencia; onListo: () => void }) {
  const [comentario, setComentario] = useState(c.comentario_entrenador ?? '')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  async function responder(estado: 'aprobada' | 'rechazada') {
    if (estado === 'rechazada' && !comentario.trim()) return setError('Contale al alumno por qué no (por ejemplo: está muy cerca de tu objetivo principal).')
    setTrabajando(true)
    const { error } = await supabase
      .from('competencias')
      .update({ estado, comentario_entrenador: comentario.trim() || null, respondida_at: new Date().toISOString() })
      .eq('id', c.id)
    setTrabajando(false)
    if (error) return setError(mensajeError(error))
    onListo()
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-azul/30 p-3">
      <AreaTexto
        id={`rev-${c.id}`}
        label="Comentario para el alumno"
        rows={2}
        placeholder="Ej: Dale, corrila como fondo a ritmo cómodo."
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      />
      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        <Boton variante="peligro" className="flex-1" disabled={trabajando} onClick={() => responder('rechazada')}>
          No aprobar
        </Boton>
        <Boton className="flex-1" disabled={trabajando} onClick={() => responder('aprobada')}>
          Aprobar
        </Boton>
      </div>
    </div>
  )
}

/** Distancias rápidas para los formularios. */
export function OpcionesDistancia({ valor, onChange }: { valor: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {['5', '10', '21,1', '42,2'].map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${valor === d ? 'border-transparent bg-azul text-white' : 'border-borde bg-white'}`}
        >
          {d.replace(',1', '').replace(',2', '')}K
        </button>
      ))}
    </div>
  )
}

export const leerKm = (t: string) => leerNumero(t)
