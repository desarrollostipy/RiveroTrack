import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { hoyPY } from '../../lib/fechas'
import { formatoFecha, formatoGs, leerNumero } from '../../lib/formato'
import { useGrupos } from '../../lib/grupos'
import { notificar } from '../../lib/push'
import type { Evento } from '../../lib/comunidad'
import { Pantalla } from '../../components/Pantalla'
import { textoFechaEvento } from '../../components/comunidad/Eventos'
import { AreaTexto, Boton, Campo, Cargando, Hoja, MensajeError, Selector, Tarjeta, Vacio } from '../../components/ui'
import { EtiquetaGrupo } from './Grupos'

type Inscripcion = { evento_id: string; alumno_id: string; created_at: string; alumnos: { nombre: string } | { nombre: string }[] | null }
const nombreDe = (i: Inscripcion) => (Array.isArray(i.alumnos) ? i.alumnos[0]?.nombre : i.alumnos?.nombre) ?? 'Alumno'

/** Eventos del grupo: crear, ver quién se anotó y avisar a los alumnos. */
export default function EventosEntrenador() {
  const hoy = hoyPY()
  const { grupos, grupo } = useGrupos()
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [inscripciones, setInscripciones] = useState<Inscripcion[]>([])
  const [editar, setEditar] = useState<Evento | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [verPasados, setVerPasados] = useState(false)
  const [f, setF] = useState({ titulo: '', descripcion: '', fecha: '', hora: '', lugar: '', cupo: '', costo: '', cierre: '', grupo_id: '' })
  const [avisar, setAvisar] = useState(true)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const [e, i] = await Promise.all([
      supabase.from('eventos').select('*').order('fecha'),
      supabase.from('inscripciones_evento').select('evento_id, alumno_id, created_at, alumnos(nombre)').order('created_at'),
    ])
    setEventos((e.data ?? []) as Evento[])
    setInscripciones((i.data ?? []) as Inscripcion[])
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  function abrir(e: Evento | null) {
    setEditar(e)
    setF({
      titulo: e?.titulo ?? '',
      descripcion: e?.descripcion ?? '',
      fecha: e?.fecha ?? '',
      hora: e?.hora?.slice(0, 5) ?? '',
      lugar: e?.lugar ?? '',
      cupo: e?.cupo ? String(e.cupo) : '',
      costo: e?.costo ? String(e.costo) : '',
      cierre: e?.cierre ?? '',
      grupo_id: e?.grupo_id ?? '',
    })
    setAvisar(!e)
    setError('')
    setAbierta(true)
  }

  async function guardar() {
    if (!f.titulo.trim()) return setError('Poné un título.')
    if (!f.fecha) return setError('Elegí la fecha.')
    if (f.cierre && f.cierre > f.fecha) return setError('El cierre de inscripciones tiene que ser antes del evento.')
    const cupo = f.cupo.trim() ? leerNumero(f.cupo) : null
    const costo = f.costo.trim() ? leerNumero(f.costo.replace(/\./g, '')) : null
    if (cupo !== null && (!cupo || cupo < 1)) return setError('El cupo tiene que ser un número.')
    const datos = {
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim() || null,
      fecha: f.fecha,
      hora: f.hora || null,
      lugar: f.lugar.trim() || null,
      cupo: cupo ? Math.round(cupo) : null,
      costo: costo ? Math.round(costo) : null,
      cierre: f.cierre || null,
      grupo_id: f.grupo_id || null,
    }
    const { data, error } = editar
      ? await supabase.from('eventos').update(datos).eq('id', editar.id).select().single()
      : await supabase.from('eventos').insert(datos).select().single()
    if (error) return setError(mensajeError(error))
    if (avisar && data) notificar({ tipo: 'evento', evento_id: (data as Evento).id })
    setAbierta(false)
    cargar()
  }

  async function borrar(e: Evento) {
    if (!confirm(`¿Borrar "${e.titulo}"? También se borran las inscripciones.`)) return
    await supabase.from('eventos').delete().eq('id', e.id)
    cargar()
  }

  async function quitar(i: Inscripcion) {
    if (!confirm(`¿Quitar a ${nombreDe(i)} de la lista?`)) return
    await supabase.from('inscripciones_evento').delete().eq('evento_id', i.evento_id).eq('alumno_id', i.alumno_id)
    cargar()
  }

  if (!eventos) return <Cargando pantalla />
  const proximos = eventos.filter((e) => e.fecha >= hoy)
  const pasados = eventos.filter((e) => e.fecha < hoy).reverse()
  const cambiar = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))

  function Tarjetas({ lista }: { lista: Evento[] }) {
    return (
      <ul className="flex flex-col gap-2">
        {lista.map((e) => {
          const anotados = inscripciones.filter((i) => i.evento_id === e.id)
          return (
            <li key={e.id}>
              <Tarjeta>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{e.titulo}</p>
                    <p className="text-sm text-texto-2">
                      {textoFechaEvento(e)}
                      {e.lugar ? ` · ${e.lugar}` : ''}
                    </p>
                    <p className="text-sm text-texto-2">
                      {e.costo ? formatoGs(e.costo) : 'Gratis'}
                      {e.cierre ? ` · cierre ${formatoFecha(e.cierre)}` : ''}
                    </p>
                    <EtiquetaGrupo grupo={grupo(e.grupo_id)} />
                  </div>
                  <span className="shrink-0 rounded-xl bg-azul/10 px-3 py-1 text-center font-titulo text-xl font-extrabold text-azul">
                    {anotados.length}
                    {e.cupo ? `/${e.cupo}` : ''}
                  </span>
                </div>
                {anotados.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-azul">Ver anotados</summary>
                    <ol className="mt-1 flex flex-col gap-1 text-sm">
                      {anotados.map((i, n) => (
                        <li key={i.alumno_id} className="flex items-center justify-between">
                          <span>
                            {n + 1}. {nombreDe(i)}
                          </span>
                          <button type="button" className="text-xs font-semibold text-mal" onClick={() => quitar(i)}>
                            Quitar
                          </button>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                <div className="mt-2 flex gap-3 text-sm font-semibold">
                  <button type="button" className="text-azul" onClick={() => abrir(e)}>
                    Editar
                  </button>
                  <button type="button" className="text-texto-2" onClick={() => borrar(e)}>
                    Borrar
                  </button>
                </div>
              </Tarjeta>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <Pantalla titulo="📅 Eventos" subtitulo="Fondos especiales, viajes a carreras…" volver="/herramientas" derecha={<Boton onClick={() => abrir(null)}>+ Nuevo</Boton>}>
      {proximos.length === 0 ? <Vacio>No hay eventos próximos. Creá uno con “+ Nuevo”.</Vacio> : <Tarjetas lista={proximos} />}
      {pasados.length > 0 && (
        <>
          <Boton variante="texto" className="self-start" onClick={() => setVerPasados(!verPasados)}>
            {verPasados ? 'Ocultar pasados' : `Ver pasados (${pasados.length})`}
          </Boton>
          {verPasados && <Tarjetas lista={pasados} />}
        </>
      )}

      <Hoja titulo={editar ? 'Editar evento' : 'Nuevo evento'} abierta={abierta} onCerrar={() => setAbierta(false)}>
        <Campo id="ev-titulo" label="Título" placeholder="Ej.: Fondo largo en San Bernardino" value={f.titulo} maxLength={80} onChange={(e) => cambiar('titulo', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Campo id="ev-fecha" type="date" label="Fecha" value={f.fecha} min={hoy} onChange={(e) => cambiar('fecha', e.target.value)} />
          <Campo id="ev-hora" type="time" label="Hora (opcional)" value={f.hora} onChange={(e) => cambiar('hora', e.target.value)} />
        </div>
        <Campo id="ev-lugar" label="Lugar (opcional)" value={f.lugar} maxLength={120} onChange={(e) => cambiar('lugar', e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Campo id="ev-cupo" label="Cupo (vacío = sin límite)" inputMode="numeric" value={f.cupo} onChange={(e) => cambiar('cupo', e.target.value)} />
          <Campo id="ev-costo" label="Costo Gs. (vacío = gratis)" inputMode="numeric" value={f.costo} onChange={(e) => cambiar('costo', e.target.value)} />
        </div>
        <Campo id="ev-cierre" type="date" label="Anotarse hasta (opcional)" value={f.cierre} onChange={(e) => cambiar('cierre', e.target.value)} />
        <Selector id="ev-grupo" label="Para" value={f.grupo_id} onChange={(e) => cambiar('grupo_id', e.target.value)}>
          <option value="">Todos los alumnos</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Selector>
        <AreaTexto id="ev-desc" label="Detalles (opcional)" rows={3} value={f.descripcion} maxLength={1000} onChange={(e) => cambiar('descripcion', e.target.value)} />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-azul)]" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
          Avisar a los alumnos con una notificación
        </label>
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar}>Guardar evento</Boton>
      </Hoja>
    </Pantalla>
  )
}
