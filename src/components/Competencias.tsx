import { useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/consultas'
import { notificar } from '../lib/push'
import { llamarFuncion } from '../lib/api'
import { diasEntre, hoyPY } from '../lib/fechas'
import { formatoDuracion, formatoFecha, leerDuracion, leerNumero, miles } from '../lib/formato'
import type { Competencia } from '../lib/tipos'
import { DISCIPLINAS, disciplinaDe, errorDistanciaComp, leerDistanciaComp, textoDistanciaComp, textoRitmoComp, valorDistanciaComp, type Disciplina } from '../lib/disciplinas'
import { AreaTexto, Boton, Campo, MensajeError } from './ui'

// Piezas compartidas entre el entrenador y el alumno para las competencias.

const ESTADO = {
  propuesta: { texto: 'Esperando aprobación', clase: 'bg-parcial text-[#0B1B3A]' },
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
    <div className="flex flex-col gap-2 rounded-2xl border border-borde bg-superficie p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {nombreAlumno && <p className="text-sm font-semibold text-azul">{nombreAlumno}</p>}
          <p className="font-semibold">
            <span aria-hidden="true">{DISCIPLINAS[disciplinaDe(c)].emoji}</span> {c.nombre}
          </p>
          <p className="text-sm text-texto-2">
            {DISCIPLINAS[disciplinaDe(c)].nombre} · {formatoFecha(c.fecha)}/{c.fecha.slice(2, 4)}
            {c.distancia_km ? ` · ${textoDistanciaComp(disciplinaDe(c), c.distancia_km)}` : ''}
            {c.lugar ? ` · ${c.lugar}` : ''}
            {c.tiempo_objetivo_seg ? ` · objetivo ${formatoDuracion(c.tiempo_objetivo_seg)}` : ''}
          </p>
        </div>
        {faltan > 0 && c.estado !== 'rechazada' ? (
          <p className="shrink-0 text-right">
            <span className="font-titulo text-2xl font-extrabold text-azul">{faltan}</span>
            <span className="block text-xs text-texto-2">{faltan === 1 ? 'día' : 'días'}</span>
          </p>
        ) : faltan === 0 && c.estado !== 'rechazada' && !c.resultado_tiempo_seg ? (
          <p className="shrink-0 rounded-full bg-azul px-3 py-1 font-titulo font-extrabold text-white">¡Hoy!</p>
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
            {kmCarrera(c) ? ` · ${textoRitmoComp(disciplinaDe(c), c.resultado_tiempo_seg, kmCarrera(c))}` : ''}
            {!c.resultado_pos_general && !c.resultado_pos_categoria && c.resultado_posicion ? ` · ${c.resultado_posicion}` : ''}
          </p>
          {(c.resultado_pos_general || c.resultado_pos_categoria) && (
            <p className="font-semibold text-tinta">
              {[
                c.resultado_pos_general ? `🏆 ${textoPuesto(c.resultado_pos_general, c.resultado_total_general)} general` : null,
                c.resultado_pos_categoria ? `🥇 ${textoPuesto(c.resultado_pos_categoria, c.resultado_total_categoria)} en ${c.resultado_categoria || 'su categoría'}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {c.tiempo_objetivo_seg && (
            <p className="text-texto-2">
              {c.resultado_tiempo_seg <= c.tiempo_objetivo_seg
                ? `¡Objetivo cumplido! (${formatoDuracion(c.tiempo_objetivo_seg - c.resultado_tiempo_seg)} menos)`
                : `${formatoDuracion(c.resultado_tiempo_seg - c.tiempo_objetivo_seg)} sobre el objetivo`}
            </p>
          )}
          {c.resultado_comentario && <p className="text-tinta">“{c.resultado_comentario}”</p>}
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

/** "15° de 320" o "15°". */
export const textoPuesto = (pos?: number | null, total?: number | null) => (pos ? `${pos}°${total ? ` de ${total}` : ''}` : null)

/** Distancia real de la carrera (la del resultado o la planificada). */
export const kmCarrera = (c: Competencia) => Number(c.resultado_distancia_km ?? c.distancia_km ?? 0) || null

type DatosGarmin = { link: string; distancia_km: number; duracion_seg: number }

/** Cargar el resultado (alumno o entrenador): desde Garmin o a mano, con posición general y por categoría. */
export function FormResultado({ c, onListo, onCancelar }: { c: Competencia; onListo: () => void; onCancelar: () => void }) {
  const [tiempo, setTiempo] = useState(c.resultado_tiempo_seg ? formatoDuracion(c.resultado_tiempo_seg) : '')
  const disciplina = disciplinaDe(c)
  const unidad = DISCIPLINAS[disciplina].unidad
  const [km, setKm] = useState(valorDistanciaComp(disciplina, kmCarrera(c)))
  const [posG, setPosG] = useState(c.resultado_pos_general ? String(c.resultado_pos_general) : '')
  const [totG, setTotG] = useState(c.resultado_total_general ? String(c.resultado_total_general) : '')
  const [categoria, setCategoria] = useState(c.resultado_categoria ?? '')
  const [posC, setPosC] = useState(c.resultado_pos_categoria ? String(c.resultado_pos_categoria) : '')
  const [totC, setTotC] = useState(c.resultado_total_categoria ? String(c.resultado_total_categoria) : '')
  const [comentario, setComentario] = useState(c.resultado_comentario ?? '')
  const [link, setLink] = useState(c.resultado_link ?? '')
  const [leyendo, setLeyendo] = useState(false)
  const [garmin, setGarmin] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const entero = (s: string) => {
    const n = leerNumero(s)
    return n === null ? null : Math.round(n)
  }

  async function leerGarmin() {
    setError('')
    setGarmin('')
    if (!/garmin\.com\/[^\s]*?activity\/\d{6,}/i.test(link)) return setError('Pegá el link (o el mensaje) que comparte Garmin Connect.')
    setLeyendo(true)
    const r = await llamarFuncion<DatosGarmin>('leer-garmin', { url: link.trim() })
    setLeyendo(false)
    if (r.error !== null) return setError(r.error)
    setLink(r.datos.link)
    setTiempo(formatoDuracion(r.datos.duracion_seg))
    setKm(valorDistanciaComp(disciplina, r.datos.distancia_km))
    setGarmin(`✓ Leído de Garmin: ${textoDistanciaComp(disciplina, r.datos.distancia_km)} en ${formatoDuracion(r.datos.duracion_seg)}. Si el tiempo oficial es otro, corregilo.`)
  }

  async function guardar() {
    setError('')
    const seg = leerDuracion(tiempo)
    if (!seg) return setError('Ingresá el tiempo, por ejemplo 48:30 o 1:42:10.')
    const distancia = km ? leerDistanciaComp(disciplina, km) : null
    if (km && (!distancia || distancia <= 0)) return setError(unidad === 'm' ? 'Revisá la distancia en metros (por ejemplo 1500).' : 'Revisá la distancia (por ejemplo 10 o 21,1).')
    const errDist = errorDistanciaComp(disciplina, distancia)
    if (errDist) return setError(errDist)
    const [pg, tg, pc, tc] = [entero(posG), entero(totG), entero(posC), entero(totC)]
    if ((pg && tg && pg > tg) || (pc && tc && pc > tc)) return setError('El puesto no puede ser mayor que la cantidad de corredores.')
    setGuardando(true)
    const { error } = await supabase.rpc('cargar_resultado_carrera', {
      p_competencia_id: c.id,
      p_tiempo_seg: seg,
      p_distancia_km: distancia,
      p_pos_general: pg,
      p_total_general: tg,
      p_categoria: categoria,
      p_pos_categoria: pc,
      p_total_categoria: tc,
      p_comentario: comentario,
      p_link: link.match(/https?:\/\/\S+/)?.[0] ?? null,
    })
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    onListo()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-azul/30 p-3">
      <div className="flex flex-col gap-2 rounded-xl bg-fondo p-3">
        <Campo
          id={`res-l-${c.id}`}
          label="⌚ Link de Garmin (opcional)"
          ayuda="Pegá el link de la actividad y tocá Leer: completa el tiempo y la distancia."
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
        <Boton variante="borde" onClick={leerGarmin} disabled={leyendo || !link.trim()}>
          {leyendo ? 'Leyendo…' : 'Leer de Garmin'}
        </Boton>
        {garmin && <p className="text-sm font-semibold text-ok">{garmin}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id={`res-t-${c.id}`} label="Tiempo final" placeholder="48:30" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        <Campo id={`res-k-${c.id}`} label={`Distancia (${unidad})`} inputMode="decimal" placeholder={unidad === 'm' ? '1500' : '10'} value={km} onChange={(e) => setKm(e.target.value)} />
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">🏆 Posición general (opcional)</legend>
        <div className="grid grid-cols-2 gap-3">
          <Campo id={`res-pg-${c.id}`} label="Puesto" inputMode="numeric" placeholder="15" value={posG} onChange={(e) => setPosG(e.target.value)} />
          <Campo id={`res-tg-${c.id}`} label="De cuántos" inputMode="numeric" placeholder="320" value={totG} onChange={(e) => setTotG(e.target.value)} />
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">🥇 Posición en tu categoría (opcional)</legend>
        <Campo id={`res-cat-${c.id}`} label="Categoría" placeholder="Ej: F30-34, Master B" maxLength={40} value={categoria} onChange={(e) => setCategoria(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo id={`res-pc-${c.id}`} label="Puesto" inputMode="numeric" placeholder="3" value={posC} onChange={(e) => setPosC(e.target.value)} />
          <Campo id={`res-tc-${c.id}`} label="De cuántos" inputMode="numeric" placeholder="45" value={totC} onChange={(e) => setTotC(e.target.value)} />
        </div>
      </fieldset>
      <AreaTexto id={`res-c-${c.id}`} label="¿Cómo te fue? (opcional)" rows={2} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        <Boton variante="borde" className="flex-1" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton className="flex-1" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar resultado'}
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
    notificar({ tipo: 'competencia', competencia_id: c.id })
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

/** Distancias rápidas para los formularios (en km o en metros según la disciplina). */
export function OpcionesDistancia({ valor, onChange, disciplina = 'running' }: { valor: string; onChange: (v: string) => void; disciplina?: Disciplina }) {
  const d = DISCIPLINAS[disciplina]
  return (
    <div className="flex flex-wrap gap-2">
      {d.distancias.map((n) => {
        const v = d.unidad === 'm' ? String(n) : String(n).replace('.', ',')
        const texto = disciplina === 'running' ? `${Math.floor(n)}K` : d.unidad === 'm' ? `${miles(n)} m` : `${n} km`
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(v)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${valor === v ? 'border-transparent bg-azul text-white' : 'border-borde bg-superficie'}`}
          >
            {texto}
          </button>
        )
      })}
    </div>
  )
}

/** Elegir la disciplina de la competencia. */
export function SelectorDisciplina({ valor, onChange }: { valor: Disciplina; onChange: (d: Disciplina) => void }) {
  return (
    <div>
      <p className="mb-1 text-sm font-medium">Disciplina</p>
      <div className="grid grid-cols-4 gap-1.5">
        {(Object.keys(DISCIPLINAS) as Disciplina[]).map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={valor === d}
            onClick={() => onChange(d)}
            className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-1 ${valor === d ? 'border-azul bg-azul/10' : 'border-borde bg-superficie'}`}
          >
            <span className="text-2xl" aria-hidden="true">
              {DISCIPLINAS[d].emoji}
            </span>
            <span className="text-xs font-semibold">{DISCIPLINAS[d].nombre}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
export const leerKm = (t: string) => leerNumero(t)
