import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { diasEntre, hoyPY } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import { activa, textoMolestia, ZONAS, type Molestia, type ZonaCuerpo } from '../../lib/salud'
import { Boton, Campo, MensajeError, Opciones, Tarjeta, Titulo, Vacio } from '../ui'
import { MapaCuerpo } from './MapaCuerpo'

function colorIntensidad(n: number) {
  return n >= 7 ? 'bg-mal text-white' : n >= 4 ? 'bg-parcial text-[#0B1B3A]' : 'bg-ok/15 text-ok'
}

/**
 * Molestias: mapa del cuerpo, las activas y el historial.
 * `puedeCargar`: el alumno marca molestias nuevas tocando el mapa.
 */
export function Molestias({ alumnoId, puedeCargar = false }: { alumnoId: string; puedeCargar?: boolean }) {
  const hoy = hoyPY()
  const [lista, setLista] = useState<Molestia[] | null>(null)
  const [elegida, setElegida] = useState<{ zona: ZonaCuerpo; lado: 'izq' | 'der' | null } | null>(null)
  const [lado, setLado] = useState<'izq' | 'der' | 'ambos' | 'ninguno'>('ninguno')
  const [intensidad, setIntensidad] = useState(5)
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [verTodas, setVerTodas] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('molestias').select('*').eq('alumno_id', alumnoId).order('fecha', { ascending: false }).limit(60)
    setLista((data ?? []) as Molestia[])
  }, [alumnoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  function elegir(zona: ZonaCuerpo, l: 'izq' | 'der' | null) {
    setElegida({ zona, lado: l })
    setLado(l ?? 'ninguno')
    setError('')
  }

  async function guardar() {
    if (!elegida) return
    const { error } = await supabase.from('molestias').insert({
      alumno_id: alumnoId,
      zona: elegida.zona,
      lado: lado === 'ninguno' ? null : lado,
      intensidad,
      nota: nota.trim() || null,
    })
    if (error) return setError(mensajeError(error))
    setElegida(null)
    setNota('')
    setIntensidad(5)
    cargar()
  }

  async function resolver(m: Molestia) {
    await supabase.from('molestias').update({ resuelta_at: new Date().toISOString() }).eq('id', m.id)
    cargar()
  }

  if (!lista) return null
  const activas = lista.filter(activa)
  const pasadas = lista.filter((m) => !activa(m))

  return (
    <Tarjeta>
      <Titulo>🩹 Molestias</Titulo>
      {puedeCargar && <p className="-mt-1 mb-2 text-sm text-texto-2">Tocá en el dibujo dónde te duele.</p>}
      <MapaCuerpo molestias={activas} elegida={elegida} onElegir={puedeCargar ? elegir : undefined} />

      {elegida && (
        <div className="mt-3 flex flex-col gap-3 rounded-2xl border-2 border-azul/30 bg-azul/5 p-3">
          <p className="font-semibold">{ZONAS[elegida.zona]}</p>
          <Opciones
            label="Lado"
            valor={lado}
            onChange={setLado}
            opciones={[
              { valor: 'der', texto: 'Derecho' },
              { valor: 'izq', texto: 'Izquierdo' },
              { valor: 'ambos', texto: 'Ambos' },
              { valor: 'ninguno', texto: 'No aplica' },
            ]}
          />
          <div>
            <label htmlFor="intensidad" className="mb-1 flex justify-between text-sm font-semibold">
              <span>¿Cuánto te duele?</span>
              <span className={`rounded-full px-2 ${colorIntensidad(intensidad)}`}>{intensidad}/10</span>
            </label>
            <input id="intensidad" type="range" min={1} max={10} value={intensidad} onChange={(e) => setIntensidad(Number(e.target.value))} className="w-full accent-[var(--color-azul)]" />
            <div className="flex justify-between text-xs text-texto-2">
              <span>Apenas</span>
              <span>No puedo correr</span>
            </div>
          </div>
          <Campo id="molestia-nota" label="¿Cuándo duele? (opcional)" placeholder="Ej.: al subir, después de correr" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
          <MensajeError>{error}</MensajeError>
          <div className="flex gap-2">
            <Boton variante="borde" className="flex-1" onClick={() => setElegida(null)}>
              Cancelar
            </Boton>
            <Boton className="flex-1" onClick={guardar}>
              Guardar
            </Boton>
          </div>
        </div>
      )}

      <p className="mb-1.5 mt-3 text-sm font-semibold text-texto-2">Activas</p>
      {activas.length === 0 ? (
        <Vacio>Sin molestias activas 🙌</Vacio>
      ) : (
        <ul className="flex flex-col gap-2">
          {activas.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 rounded-xl border border-borde p-3">
              <div className="min-w-0">
                <p className="font-semibold">{textoMolestia(m)}</p>
                <p className="text-sm text-texto-2">
                  Desde el {formatoFecha(m.fecha)} · hace {diasEntre(m.fecha, hoy)} días{m.nota ? ` · ${m.nota}` : ''}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className={`rounded-full px-2 py-0.5 text-sm font-bold ${colorIntensidad(m.intensidad)}`}>{m.intensidad}/10</span>
                <button type="button" className="text-sm font-semibold text-azul" onClick={() => resolver(m)}>
                  ✓ Ya pasó
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pasadas.length > 0 && (
        <>
          <button type="button" className="mt-3 text-sm font-semibold text-azul" onClick={() => setVerTodas(!verTodas)}>
            {verTodas ? 'Ocultar historial' : `Ver historial (${pasadas.length})`}
          </button>
          {verTodas && (
            <ul className="mt-2 flex flex-col gap-1 text-sm text-texto-2">
              {pasadas.map((m) => (
                <li key={m.id}>
                  {formatoFecha(m.fecha)} · {textoMolestia(m)} · {m.intensidad}/10{m.resuelta_at ? ` · resuelta el ${formatoFecha(m.resuelta_at.slice(0, 10))}` : ''}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  )
}
