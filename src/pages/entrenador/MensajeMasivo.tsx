import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { useGrupos } from '../../lib/grupos'
import { notificar } from '../../lib/push'
import type { PlantillaMensaje } from '../../lib/comunidad'
import { Pantalla } from '../../components/Pantalla'
import { AreaTexto, Boton, Campo, Cargando, Hoja, MensajeError, MensajeOk, Opciones, Tarjeta, Titulo } from '../../components/ui'

type AlumnoMin = { id: string; nombre: string; grupo_id: string | null; profile_id: string | null }
type Destino = 'todos' | 'grupo' | 'elegir'

const SUGERIDAS = [
  { titulo: 'Lluvia', texto: 'Hoy se suspende el entrenamiento por lluvia 🌧️. Hacé la sesión en casa o mañana. ¡Abrazo!' },
  { titulo: 'Recordatorio', texto: 'Recuerden registrar sus sesiones de esta semana en la app 🏃 ¡Así puedo ajustar sus planes!' },
  { titulo: 'Felicitaciones', texto: '¡Felicitaciones a todos por la carrera de hoy! 🏁 Estoy muy orgulloso del equipo 💪' },
]

/** Mensaje a todos, a un grupo o a varios alumnos: llega a cada chat y como notificación. */
export default function MensajeMasivo() {
  const { grupos } = useGrupos()
  const [alumnos, setAlumnos] = useState<AlumnoMin[] | null>(null)
  const [plantillas, setPlantillas] = useState<PlantillaMensaje[]>([])
  const [destino, setDestino] = useState<Destino>('todos')
  const [grupoId, setGrupoId] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [guardarComo, setGuardarComo] = useState(false)
  const [tituloPlantilla, setTituloPlantilla] = useState('')

  const cargar = useCallback(async () => {
    const [a, p] = await Promise.all([
      supabase.from('alumnos').select('id, nombre, grupo_id, profile_id').eq('activo', true).order('nombre'),
      supabase.from('plantillas_mensaje').select('*').order('titulo'),
    ])
    setAlumnos((a.data ?? []) as AlumnoMin[])
    setPlantillas((p.data ?? []) as PlantillaMensaje[])
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!alumnos) return <Cargando pantalla />
  // Solo a quienes ya entran a la app (tienen acceso).
  const conApp = alumnos.filter((a) => a.profile_id)
  const destinatarios = destino === 'todos' ? conApp : destino === 'grupo' ? conApp.filter((a) => a.grupo_id === grupoId) : conApp.filter((a) => elegidos.includes(a.id))

  async function enviar() {
    setError('')
    setOk('')
    if (!texto.trim()) return setError('Escribí el mensaje.')
    if (!destinatarios.length) return setError('Elegí a quién mandarlo.')
    if (!confirm(`¿Mandar el mensaje a ${destinatarios.length} alumno${destinatarios.length === 1 ? '' : 's'}?`)) return
    setEnviando(true)
    const { error } = await supabase.from('mensajes').insert(destinatarios.map((a) => ({ alumno_id: a.id, texto: texto.trim() })))
    setEnviando(false)
    if (error) return setError(mensajeError(error))
    notificar({ tipo: 'masivo', alumno_ids: destinatarios.map((a) => a.id), texto: texto.trim() })
    setOk(`Mensaje enviado a ${destinatarios.length} alumno${destinatarios.length === 1 ? '' : 's'}. Les llega a su chat.`)
    setTexto('')
  }

  async function guardarPlantilla() {
    if (!tituloPlantilla.trim() || !texto.trim()) return
    const { error } = await supabase.from('plantillas_mensaje').insert({ titulo: tituloPlantilla.trim(), texto: texto.trim() })
    if (error) return setError(mensajeError(error))
    setGuardarComo(false)
    setTituloPlantilla('')
    cargar()
  }

  async function borrarPlantilla(p: PlantillaMensaje) {
    if (!confirm(`¿Borrar la plantilla "${p.titulo}"?`)) return
    await supabase.from('plantillas_mensaje').delete().eq('id', p.id)
    cargar()
  }

  return (
    <Pantalla titulo="✉️ Mensaje a varios" subtitulo="Llega al chat de cada uno y como notificación" volver="/herramientas">
      <Tarjeta>
        <Titulo>Para</Titulo>
        <Opciones
          label="Destinatarios"
          valor={destino}
          onChange={setDestino}
          opciones={[
            { valor: 'todos', texto: `Todos (${conApp.length})` },
            { valor: 'grupo', texto: 'Un grupo' },
            { valor: 'elegir', texto: 'Elegir' },
          ]}
        />
        {destino === 'grupo' && (
          <div className="mt-2 flex flex-wrap gap-2">
            {grupos.map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={grupoId === g.id}
                onClick={() => setGrupoId(g.id)}
                className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${grupoId === g.id ? 'text-white' : ''}`}
                style={{ borderColor: g.color, background: grupoId === g.id ? g.color : undefined }}
              >
                {g.nombre} ({conApp.filter((a) => a.grupo_id === g.id).length})
              </button>
            ))}
          </div>
        )}
        {destino === 'elegir' && (
          <ul className="mt-2 grid max-h-64 grid-cols-2 gap-1 overflow-y-auto">
            {conApp.map((a) => (
              <li key={a.id}>
                <label className="flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm hover:bg-fondo">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-[var(--color-azul)]"
                    checked={elegidos.includes(a.id)}
                    onChange={(e) => setElegidos(e.target.checked ? [...elegidos, a.id] : elegidos.filter((x) => x !== a.id))}
                  />
                  <span className="truncate">{a.nombre}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
        {alumnos.length > conApp.length && <p className="mt-2 text-xs text-texto-2">{alumnos.length - conApp.length} alumno(s) sin acceso a la app no lo reciben.</p>}
      </Tarjeta>

      <Tarjeta>
        <Titulo>Mensaje</Titulo>
        <div className="mb-2 flex flex-wrap gap-2">
          {[...plantillas, ...SUGERIDAS.filter((s) => !plantillas.some((p) => p.titulo === s.titulo)).map((s) => ({ ...s, id: '' }))].map((p) => (
            <span key={p.titulo} className="flex items-center rounded-full border border-borde bg-superficie text-sm font-semibold">
              <button type="button" className="px-3 py-1.5" onClick={() => setTexto(p.texto)}>
                📝 {p.titulo}
              </button>
              {p.id && (
                <button type="button" className="pr-2 text-texto-2" aria-label={`Borrar plantilla ${p.titulo}`} onClick={() => borrarPlantilla(p as PlantillaMensaje)}>
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        <AreaTexto id="masivo-texto" label="Texto" rows={4} value={texto} maxLength={1000} onChange={(e) => setTexto(e.target.value)} />
        {texto.trim() && (
          <button type="button" className="mt-1 text-sm font-semibold text-azul" onClick={() => setGuardarComo(true)}>
            💾 Guardar como plantilla
          </button>
        )}
        <MensajeError>{error}</MensajeError>
        <MensajeOk>{ok}</MensajeOk>
        <Boton className="mt-2 w-full" onClick={enviar} disabled={enviando || !destinatarios.length || !texto.trim()}>
          {enviando ? 'Enviando…' : `Enviar a ${destinatarios.length} alumno${destinatarios.length === 1 ? '' : 's'}`}
        </Boton>
      </Tarjeta>

      <Hoja titulo="Guardar plantilla" abierta={guardarComo} onCerrar={() => setGuardarComo(false)}>
        <Campo id="pl-titulo" label="Nombre de la plantilla" placeholder="Ej.: Lluvia" value={tituloPlantilla} maxLength={60} onChange={(e) => setTituloPlantilla(e.target.value)} />
        <p className="rounded-xl bg-fondo p-3 text-sm">{texto}</p>
        <Boton onClick={guardarPlantilla}>Guardar</Boton>
      </Hoja>
    </Pantalla>
  )
}
