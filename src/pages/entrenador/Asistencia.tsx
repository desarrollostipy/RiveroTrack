import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { useGrupos } from '../../lib/grupos'
import { DIAS, diaSemana, hoyPY } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import type { Alumno, EntrenamientoGrupal } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Campo, Cargando, Hoja, MensajeError, Opciones, Selector, Vacio } from '../../components/ui'
import { EtiquetaGrupo } from './Grupos'

// Entrenamientos grupales y quién vino.
export default function Asistencia() {
  const navigate = useNavigate()
  const { grupos, grupo } = useGrupos()
  const [lista, setLista] = useState<(EntrenamientoGrupal & { presentes: number })[] | null>(null)
  const [nuevo, setNuevo] = useState(false)
  const [fecha, setFecha] = useState(hoyPY())
  const [hora, setHora] = useState('06:00')
  const [lugar, setLugar] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('entrenamientos_grupales').select('*').order('fecha', { ascending: false }).limit(60),
      supabase.from('asistencias').select('entrenamiento_id'),
    ]).then(([e, a]) => {
      const c: Record<string, number> = {}
      for (const x of (a.data ?? []) as { entrenamiento_id: string }[]) c[x.entrenamiento_id] = (c[x.entrenamiento_id] ?? 0) + 1
      setLista(((e.data ?? []) as EntrenamientoGrupal[]).map((x) => ({ ...x, presentes: c[x.id] ?? 0 })))
    })
  }, [])

  async function crear() {
    setError('')
    const { data, error } = await supabase
      .from('entrenamientos_grupales')
      .insert({ fecha, hora: hora || null, lugar: lugar.trim() || null, grupo_id: grupoId || null })
      .select('id')
      .single()
    if (error) return setError(mensajeError(error))
    navigate(`/asistencia/${(data as { id: string }).id}`)
  }

  return (
    <Pantalla titulo="Asistencia" subtitulo="Entrenamientos grupales" volver="/herramientas" derecha={<Boton onClick={() => setNuevo(true)}>+ Nuevo</Boton>}>
      {lista === null && <Cargando />}
      {lista?.length === 0 && <Vacio>Creá un entrenamiento (por ejemplo, "Pista martes 6:00") y marcá quién vino.</Vacio>}
      <ul className="flex flex-col gap-2">
        {lista?.map((e) => (
          <li key={e.id}>
            <Link to={`/asistencia/${e.id}`} className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border border-borde bg-superficie p-3 hover:border-azul">
              <span>
                <span className="block font-semibold">
                  {DIAS[diaSemana(e.fecha)]} {formatoFecha(e.fecha)}
                  {e.hora ? ` · ${e.hora.slice(0, 5)}` : ''}
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-sm text-texto-2">
                  {e.lugar ?? 'Sin lugar'}
                  <EtiquetaGrupo grupo={grupo(e.grupo_id)} />
                </span>
              </span>
              <span className="text-right">
                <span className="font-titulo text-2xl font-extrabold text-azul">{e.presentes}</span>
                <span className="block text-xs text-texto-2">presentes</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <Hoja titulo="Nuevo entrenamiento grupal" abierta={nuevo} onCerrar={() => setNuevo(false)}>
        <div className="grid grid-cols-2 gap-3">
          <Campo id="ag-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <Campo id="ag-hora" label="Hora" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        <Campo id="ag-lugar" label="Lugar" placeholder="Ej: Pista del Comité · Costanera" value={lugar} onChange={(e) => setLugar(e.target.value)} />
        <Selector id="ag-grupo" label="Grupo (opcional)" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
          <option value="">Todos</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Selector>
        <MensajeError>{error}</MensajeError>
        <Boton onClick={crear}>Crear y tomar asistencia</Boton>
      </Hoja>
    </Pantalla>
  )
}

/** Tomar asistencia: tocar a cada alumno que vino. */
export function TomarAsistencia() {
  const { id } = useParams()
  const { grupos } = useGrupos()
  const [e, setE] = useState<EntrenamientoGrupal | null>(null)
  const [alumnos, setAlumnos] = useState<Pick<Alumno, 'id' | 'nombre' | 'grupo_id'>[]>([])
  const [presentes, setPresentes] = useState<Set<string>>(new Set())
  const [filtro, setFiltro] = useState<string>('todos')
  const [buscar, setBuscar] = useState('')

  const cargar = useCallback(async () => {
    const [en, al, as] = await Promise.all([
      supabase.from('entrenamientos_grupales').select('*').eq('id', id!).maybeSingle(),
      supabase.from('alumnos').select('id, nombre, grupo_id').eq('activo', true).order('nombre'),
      supabase.from('asistencias').select('alumno_id').eq('entrenamiento_id', id!),
    ])
    const ent = en.data as EntrenamientoGrupal | null
    setE(ent)
    setAlumnos((al.data ?? []) as Alumno[])
    setPresentes(new Set(((as.data ?? []) as { alumno_id: string }[]).map((x) => x.alumno_id)))
    if (ent?.grupo_id) setFiltro(ent.grupo_id)
  }, [id])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function alternar(alumnoId: string) {
    const esta = presentes.has(alumnoId)
    const nuevo = new Set(presentes)
    if (esta) nuevo.delete(alumnoId)
    else nuevo.add(alumnoId)
    setPresentes(nuevo)
    const { error } = esta
      ? await supabase.from('asistencias').delete().eq('entrenamiento_id', id!).eq('alumno_id', alumnoId)
      : await supabase.from('asistencias').insert({ entrenamiento_id: id, alumno_id: alumnoId })
    if (error) cargar()
  }

  async function borrar() {
    if (!confirm('¿Borrar este entrenamiento y su asistencia?')) return
    await supabase.from('entrenamientos_grupales').delete().eq('id', id!)
    history.back()
  }

  const visibles = useMemo(
    () => alumnos.filter((a) => (filtro === 'todos' || a.grupo_id === filtro) && a.nombre.toLowerCase().includes(buscar.trim().toLowerCase())),
    [alumnos, filtro, buscar],
  )

  if (!e) return <Cargando pantalla />
  return (
    <Pantalla
      titulo={`${DIAS[diaSemana(e.fecha)]} ${formatoFecha(e.fecha)}${e.hora ? ' · ' + e.hora.slice(0, 5) : ''}`}
      subtitulo={`${e.lugar ?? 'Entrenamiento grupal'} · ${presentes.size} presentes`}
      volver="/asistencia"
    >
      {grupos.length > 0 && (
        <Opciones label="Mostrar" valor={filtro} onChange={setFiltro} opciones={[{ valor: 'todos', texto: 'Todos' }, ...grupos.map((g) => ({ valor: g.id, texto: g.nombre }))]} />
      )}
      <Campo id="asist-buscar" label="Buscar" value={buscar} onChange={(ev) => setBuscar(ev.target.value)} />
      <ul className="flex flex-col gap-1.5">
        {visibles.map((a) => {
          const esta = presentes.has(a.id)
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={esta}
                onClick={() => alternar(a.id)}
                className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left font-semibold ${esta ? 'border-ok bg-ok/15 text-ok' : 'border-borde bg-superficie'}`}
              >
                {a.nombre}
                <span aria-hidden="true">{esta ? '✓ Vino' : '—'}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <Boton variante="peligro" className="mt-4" onClick={borrar}>
        Borrar entrenamiento
      </Boton>
    </Pantalla>
  )
}
