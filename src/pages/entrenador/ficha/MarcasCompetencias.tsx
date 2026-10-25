import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { mensajeError } from '../../../lib/consultas'
import { hoyPY } from '../../../lib/fechas'
import { formatoDuracion, formatoFecha, leerDuracion } from '../../../lib/formato'
import type { Competencia, Marca } from '../../../lib/tipos'
import { Boton, Campo, Hoja, MensajeError, MensajeOk, Opciones, Selector, Tarjeta, Titulo } from '../../../components/ui'
import { DetalleCompetencia, distanciaMarca, FormResultado, RevisarCompetencia, SelectorDisciplina } from '../../../components/Competencias'
import { DISCIPLINAS, disciplinaDe, errorDistanciaComp, leerDistanciaComp, type Disciplina } from '../../../lib/disciplinas'

export function Competencias({ alumnoId, onMarca }: { alumnoId: string; onMarca?: () => void }) {
  const hoy = hoyPY()
  const [lista, setLista] = useState<Competencia[]>([])
  const [abierta, setAbierta] = useState(false)
  const [resultadoDe, setResultadoDe] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('competencias').select('*').eq('alumno_id', alumnoId).order('fecha')
    setLista((data ?? []) as Competencia[])
  }, [alumnoId])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function borrar(c: Competencia) {
    if (!confirm(`¿Borrar "${c.nombre}"?`)) return
    await supabase.from('competencias').delete().eq('id', c.id)
    cargar()
  }

  async function guardarMarca(c: Competencia) {
    const distancia = distanciaMarca(c.distancia_km)
    if (!distancia || !c.resultado_tiempo_seg) return
    const { error } = await supabase
      .from('marcas_personales')
      .insert({ alumno_id: alumnoId, distancia, tiempo_seg: c.resultado_tiempo_seg, fecha: c.fecha, carrera: c.nombre })
    setAviso(error ? mensajeError(error) : `Marca de ${distancia} guardada.`)
    onMarca?.()
  }

  const proximas = lista.filter((c) => c.fecha > hoy || (c.fecha === hoy && c.estado !== 'aprobada'))
  const pasadas = lista.filter((c) => c.fecha <= hoy && c.estado === 'aprobada').reverse()
  const pendientes = proximas.filter((c) => c.estado === 'propuesta').length

  return (
    <Tarjeta>
      <Titulo accion={<Boton variante="texto" onClick={() => setAbierta(true)}>+ Competencia</Boton>}>
        Competencias{pendientes ? <span className="ml-2 whitespace-nowrap rounded-full bg-parcial px-2 align-middle text-sm text-[#0B1B3A]">{pendientes} para aprobar</span> : null}
      </Titulo>
      <MensajeOk>{aviso}</MensajeOk>
      {proximas.length === 0 && <p className="text-sm text-texto-2">Sin competencias próximas.</p>}
      <div className="flex flex-col gap-2">
        {proximas.map((c) => (
          <DetalleCompetencia key={c.id} c={c}>
            {c.estado === 'propuesta' ? (
              <RevisarCompetencia c={c} onListo={cargar} />
            ) : (
              <Boton variante="texto" className="self-start" onClick={() => borrar(c)}>
                Borrar
              </Boton>
            )}
          </DetalleCompetencia>
        ))}
      </div>

      {pasadas.length > 0 && (
        <details className="mt-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold text-azul">Historial de carreras ({pasadas.length})</summary>
          <div className="flex flex-col gap-2">
            {pasadas.map((c) => (
              <DetalleCompetencia key={c.id} c={c}>
                {resultadoDe === c.id ? (
                  <FormResultado c={c} onCancelar={() => setResultadoDe(null)} onListo={() => (setResultadoDe(null), cargar())} />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Boton variante="texto" onClick={() => setResultadoDe(c.id)}>
                      {c.resultado_tiempo_seg ? 'Editar resultado' : 'Cargar resultado'}
                    </Boton>
                    {c.resultado_tiempo_seg && disciplinaDe(c) === 'running' && distanciaMarca(c.distancia_km) && (
                      <Boton variante="borde" onClick={() => guardarMarca(c)}>
                        Guardar como marca personal
                      </Boton>
                    )}
                  </div>
                )}
              </DetalleCompetencia>
            ))}
          </div>
        </details>
      )}
      <NuevaCompetencia alumnoId={alumnoId} abierta={abierta} onCerrar={() => setAbierta(false)} onListo={cargar} />
    </Tarjeta>
  )
}
function NuevaCompetencia({ alumnoId, abierta, onCerrar, onListo }: { alumnoId: string; abierta: boolean; onCerrar: () => void; onListo: () => void }) {
  const [disciplina, setDisciplina] = useState<Disciplina>('running')
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [km, setKm] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [prioridad, setPrioridad] = useState<'A' | 'B' | 'C'>('A')
  const [error, setError] = useState('')

  async function guardar() {
    if (!nombre.trim() || !fecha) return setError('Completá el nombre y la fecha.')
    const errDist = errorDistanciaComp(disciplina, km.trim() ? leerDistanciaComp(disciplina, km) : null)
    if (errDist) return setError(errDist)
    const { error } = await supabase.from('competencias').insert({
      alumno_id: alumnoId,
      nombre: nombre.trim(),
      fecha,
      distancia_km: leerDistanciaComp(disciplina, km),
      ...(disciplina !== 'running' ? { disciplina } : {}),
      tiempo_objetivo_seg: objetivo ? leerDuracionCarrera(objetivo) : null,
      prioridad,
    })
    if (error) return setError(mensajeError(error))
    setDisciplina('running')
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
      <SelectorDisciplina valor={disciplina} onChange={(d) => (setDisciplina(d), setKm(''))} />
      <Campo id="comp-nombre" label="Nombre" placeholder="Ej: 21K de Asunción" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo id="comp-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <Campo id="comp-km" label={`Distancia (${DISCIPLINAS[disciplina].unidad})`} inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
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
