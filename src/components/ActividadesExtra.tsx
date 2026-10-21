import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/consultas'
import { DIAS, diaSemana, hoyPY, sumarDias } from '../lib/fechas'
import { formatoFecha, leerNumero } from '../lib/formato'
import { DEPORTES, nombreActividad, textoDistancia, type ActividadExtra, type Deporte } from '../lib/extras'
import { AreaTexto, Boton, Campo, Hoja, MensajeError, Opciones } from './ui'

const SENSACIONES = [
  { valor: 1, texto: '😣' },
  { valor: 2, texto: '😕' },
  { valor: 3, texto: '🙂' },
  { valor: 4, texto: '😄' },
  { valor: 5, texto: '🤩' },
]

/** Una actividad extra en forma de etiqueta: "🏊 Natación · 45 min · 1.500 m". */
export function ChipExtra({ a, onBorrar }: { a: ActividadExtra; onBorrar?: () => void }) {
  const partes = [`${a.duracion_min} min`, textoDistancia(a), a.sensacion ? SENSACIONES[a.sensacion - 1].texto : null].filter(Boolean)
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl bg-[#0F6E78]/10 px-3 py-2 text-sm">
      <div className="min-w-0">
        <p>
          <span aria-hidden="true">{DEPORTES[a.deporte].emoji}</span> <b>{nombreActividad(a)}</b>
          <span className="text-texto-2"> · {partes.join(' · ')}</span>
        </p>
        {a.comentario && <p className="text-texto-2">{a.comentario}</p>}
      </div>
      {onBorrar && (
        <button type="button" className="shrink-0 text-xs font-semibold text-texto-2 hover:text-mal" onClick={onBorrar} aria-label={`Borrar ${nombreActividad(a)}`}>
          Borrar
        </button>
      )}
    </div>
  )
}

/** Cargar una actividad extra: natación, bici, gimnasio… (no la planifica el entrenador). */
export function FormExtra({ alumnoId, fecha, abierta, onCerrar, onListo }: { alumnoId: string; fecha: string; abierta: boolean; onCerrar: () => void; onListo: () => void }) {
  const hoy = hoyPY()
  const [dia, setDia] = useState(fecha)
  const [deporte, setDeporte] = useState<Deporte | null>(null)
  const [nombre, setNombre] = useState('')
  const [minutos, setMinutos] = useState('')
  const [distancia, setDistancia] = useState('')
  const [fc, setFc] = useState('')
  const [sensacion, setSensacion] = useState<number | null>(null)
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierta) return
    setDia(fecha)
    setDeporte(null)
    setNombre('')
    setMinutos('')
    setDistancia('')
    setFc('')
    setSensacion(null)
    setComentario('')
    setError('')
  }, [abierta, fecha])

  const unidad = deporte ? DEPORTES[deporte].distancia : null

  async function guardar() {
    setError('')
    if (!deporte) return setError('Elegí la actividad.')
    if (deporte === 'otro' && !nombre.trim()) return setError('Escribí qué actividad hiciste.')
    const min = leerNumero(minutos)
    if (!min || min <= 0 || min > 1440) return setError('Escribí cuántos minutos duró.')
    const dist = distancia.trim() ? leerNumero(distancia) : null
    if (distancia.trim() && (!dist || dist <= 0)) return setError('La distancia tiene que ser un número.')
    const fcProm = fc.trim() ? leerNumero(fc) : null
    if (fc.trim() && (!fcProm || fcProm < 40 || fcProm > 240)) return setError('El pulso va entre 40 y 240.')
    setGuardando(true)
    const { error } = await supabase.from('actividades_extra').insert({
      alumno_id: alumnoId,
      fecha: dia,
      deporte,
      nombre: deporte === 'otro' ? nombre.trim() : null,
      duracion_min: Math.round(min),
      // Natación se carga en metros y se guarda en km.
      distancia_km: dist ? Math.round((unidad === 'm' ? dist / 1000 : dist) * 100) / 100 : null,
      fc_prom: fcProm ? Math.round(fcProm) : null,
      sensacion,
      comentario: comentario.trim() || null,
    })
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    onListo()
    onCerrar()
  }

  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(hoy, -i))

  return (
    <Hoja titulo="Actividad extra" abierta={abierta} onCerrar={onCerrar}>
      <p className="-mt-2 text-sm text-texto-2">Algo que hiciste además de tu plan. Tu entrenador lo ve en tu semana.</p>
      <div>
        <p className="mb-1 text-sm font-semibold">¿Qué hiciste?</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(Object.keys(DEPORTES) as Deporte[]).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={deporte === d}
              onClick={() => setDeporte(d)}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-2 p-1 text-center ${deporte === d ? 'border-azul bg-azul/10' : 'border-borde bg-superficie'}`}
            >
              <span className="text-2xl" aria-hidden="true">
                {DEPORTES[d].emoji}
              </span>
              <span className="text-[0.6rem] font-semibold leading-tight">{DEPORTES[d].nombre}</span>
            </button>
          ))}
        </div>
      </div>
      {deporte === 'otro' && <Campo id="ex-nombre" label="¿Cuál?" placeholder="Ej.: Remo, Crossfit…" value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value)} />}
      <Opciones
        label="Día"
        valor={dia}
        onChange={setDia}
        opciones={dias.map((d) => ({ valor: d, texto: d === hoy ? 'Hoy' : d === sumarDias(hoy, -1) ? 'Ayer' : `${DIAS[diaSemana(d)].slice(0, 3)} ${formatoFecha(d)}` }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="ex-min" label="Duración (min)" inputMode="numeric" value={minutos} onChange={(e) => setMinutos(e.target.value.replace(/\D/g, ''))} />
        {unidad && (
          <Campo id="ex-dist" label={`Distancia (${unidad})`} inputMode="decimal" placeholder={unidad === 'm' ? '1500' : ''} value={distancia} onChange={(e) => setDistancia(e.target.value)} />
        )}
        <Campo id="ex-fc" label="Pulso prom. (opcional)" inputMode="numeric" value={fc} onChange={(e) => setFc(e.target.value.replace(/\D/g, ''))} />
      </div>
      <Opciones label="¿Cómo te sentiste? (opcional)" valor={sensacion} onChange={(v) => setSensacion(v === sensacion ? null : v)} opciones={SENSACIONES} />
      <AreaTexto id="ex-com" label="Comentario (opcional)" rows={2} value={comentario} maxLength={300} onChange={(e) => setComentario(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar} disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar actividad'}
      </Boton>
    </Hoja>
  )
}
