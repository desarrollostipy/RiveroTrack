import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { mensajeError } from '../../../lib/consultas'
import { diasEntre, hoyPY } from '../../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, leerDuracion, leerNumero } from '../../../lib/formato'
import type { Competencia, Marca } from '../../../lib/tipos'
import { Boton, Campo, Hoja, MensajeError, Opciones, Selector, Tarjeta, Titulo } from '../../../components/ui'

export function Competencias({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const [lista, setLista] = useState<Competencia[]>([])
  const [abierta, setAbierta] = useState(false)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('competencias').select('*').eq('alumno_id', alumnoId).gte('fecha', hoy).order('fecha')
    setLista((data ?? []) as Competencia[])
  }, [alumnoId, hoy])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function borrar(c: Competencia) {
    if (!confirm(`¿Borrar "${c.nombre}"?`)) return
    await supabase.from('competencias').delete().eq('id', c.id)
    cargar()
  }

  const [proxima, ...resto] = lista

  return (
    <Tarjeta>
      <Titulo accion={<Boton variante="texto" onClick={() => setAbierta(true)}>+ Competencia</Boton>}>Próxima competencia</Titulo>
      {!proxima && <p className="text-sm text-texto-2">Sin competencias cargadas.</p>}
      {proxima && (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">
              {proxima.nombre} <span className="text-xs text-texto-2">· Prioridad {proxima.prioridad}</span>
            </p>
            <p className="text-sm text-texto-2">
              {formatoFecha(proxima.fecha)}
              {proxima.distancia_km ? ` · ${formatoKm(proxima.distancia_km)} km` : ''}
              {proxima.tiempo_objetivo_seg ? ` · objetivo ${formatoDuracion(proxima.tiempo_objetivo_seg)}` : ''}
            </p>
          </div>
          <p className="shrink-0 text-right">
            <span className="font-titulo text-2xl font-extrabold text-azul">{diasEntre(hoy, proxima.fecha)}</span>
            <span className="block text-xs text-texto-2">días</span>
          </p>
        </div>
      )}
      {lista.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer content-center text-azul">Ver todas ({lista.length})</summary>
          <ul className="flex flex-col divide-y divide-borde">
            {[proxima, ...resto].map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1">
                <span>
                  {formatoFecha(c.fecha)} · {c.nombre} ({c.prioridad})
                </span>
                <Boton variante="texto" onClick={() => borrar(c)} aria-label={`Borrar ${c.nombre}`}>
                  ✕
                </Boton>
              </li>
            ))}
          </ul>
        </details>
      )}
      <NuevaCompetencia alumnoId={alumnoId} abierta={abierta} onCerrar={() => setAbierta(false)} onListo={cargar} />
    </Tarjeta>
  )
}

function NuevaCompetencia({ alumnoId, abierta, onCerrar, onListo }: { alumnoId: string; abierta: boolean; onCerrar: () => void; onListo: () => void }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [km, setKm] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [prioridad, setPrioridad] = useState<'A' | 'B' | 'C'>('A')
  const [error, setError] = useState('')

  async function guardar() {
    if (!nombre.trim() || !fecha) return setError('Completá el nombre y la fecha.')
    const { error } = await supabase.from('competencias').insert({
      alumno_id: alumnoId,
      nombre: nombre.trim(),
      fecha,
      distancia_km: leerNumero(km),
      tiempo_objetivo_seg: objetivo ? leerDuracionCarrera(objetivo) : null,
      prioridad,
    })
    if (error) return setError(mensajeError(error))
    setNombre('')
    setFecha('')
    setKm('')
    setObjetivo('')
    setError('')
    onCerrar()
    onListo()
  }

  return (
    <Hoja titulo="Nueva competencia" abierta={abierta} onCerrar={onCerrar}>
      <Campo id="comp-nombre" label="Nombre" placeholder="Ej: 21K de Asunción" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo id="comp-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="comp-km" label="Distancia (km)" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
        <Campo id="comp-obj" label="Tiempo objetivo" placeholder="1:45:00" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
      </div>
      <Opciones
        label="Prioridad"
        valor={prioridad}
        onChange={setPrioridad}
        opciones={[
          { valor: 'A', texto: 'A (principal)' },
          { valor: 'B', texto: 'B' },
          { valor: 'C', texto: 'C' },
        ]}
      />
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar}>Guardar competencia</Boton>
    </Hoja>
  )
}

// En carreras "45:30" son minutos:segundos y "1:45:00" horas:min:seg.
const leerDuracionCarrera = (t: string) => leerDuracion(t)

const DISTANCIAS = ['5K', '10K', '21K', '42K', 'otra'] as const

export function Marcas({ alumnoId }: { alumnoId: string }) {
  const [lista, setLista] = useState<Marca[]>([])
  const [abierta, setAbierta] = useState(false)
  const [distancia, setDistancia] = useState<Marca['distancia']>('10K')
  const [tiempo, setTiempo] = useState('')
  const [fecha, setFecha] = useState('')
  const [carrera, setCarrera] = useState('')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('marcas_personales').select('*').eq('alumno_id', alumnoId)
    setLista(((data ?? []) as Marca[]).sort((a, b) => DISTANCIAS.indexOf(a.distancia) - DISTANCIAS.indexOf(b.distancia)))
  }, [alumnoId])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function guardar() {
    const seg = leerDuracion(tiempo)
    if (!seg) return setError('Ingresá el tiempo, por ejemplo 48:30 o 1:42:10.')
    const { error } = await supabase
      .from('marcas_personales')
      .insert({ alumno_id: alumnoId, distancia, tiempo_seg: seg, fecha: fecha || null, carrera: carrera.trim() || null })
    if (error) return setError(mensajeError(error))
    setTiempo('')
    setFecha('')
    setCarrera('')
    setError('')
    setAbierta(false)
    cargar()
  }

  async function borrar(m: Marca) {
    if (!confirm(`¿Borrar la marca de ${m.distancia}?`)) return
    await supabase.from('marcas_personales').delete().eq('id', m.id)
    cargar()
  }

  return (
    <Tarjeta>
      <Titulo accion={<Boton variante="texto" onClick={() => setAbierta(true)}>+ Marca</Boton>}>Marcas personales</Titulo>
      {lista.length === 0 && <p className="text-sm text-texto-2">Sin marcas cargadas.</p>}
      <ul className="flex flex-col divide-y divide-borde">
        {lista.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm">
              <strong>{m.distancia}</strong> <span className="font-mono">{formatoDuracion(m.tiempo_seg)}</span>
              <span className="text-texto-2">
                {m.carrera ? ` · ${m.carrera}` : ''}
                {m.fecha ? ` · ${formatoFecha(m.fecha)}/${m.fecha.slice(2, 4)}` : ''}
              </span>
            </span>
            <Boton variante="texto" onClick={() => borrar(m)} aria-label={`Borrar marca de ${m.distancia}`}>
              ✕
            </Boton>
          </li>
        ))}
      </ul>
      <Hoja titulo="Nueva marca personal" abierta={abierta} onCerrar={() => setAbierta(false)}>
        <Selector id="marca-dist" label="Distancia" value={distancia} onChange={(e) => setDistancia(e.target.value as Marca['distancia'])}>
          {DISTANCIAS.map((d) => (
            <option key={d} value={d}>
              {d === 'otra' ? 'Otra' : d}
            </option>
          ))}
        </Selector>
        <Campo id="marca-tiempo" label="Tiempo" placeholder="48:30 o 1:42:10" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        <Campo id="marca-carrera" label="Carrera (opcional)" value={carrera} onChange={(e) => setCarrera(e.target.value)} />
        <Campo id="marca-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar}>Guardar marca</Boton>
      </Hoja>
    </Tarjeta>
  )
}
