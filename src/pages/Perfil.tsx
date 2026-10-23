import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { useSesion } from '../lib/sesion'
import { useMiAlumno } from '../lib/alumno'
import { mensajeError } from '../lib/consultas'
import { esPinValido } from '../lib/acceso'
import { guardarTema, preferenciaTema, type PreferenciaTema } from '../lib/tema'
import { activarPush, desactivarPush, esIphoneSinInstalar, notificar, pushSoportado, suscripcionActual } from '../lib/push'
import { Pantalla } from '../components/Pantalla'
import { Firma } from '../components/Firma'
import { Avatar, Boton, Campo, estadoVigente, GloboEstado, MensajeError, MensajeOk, Opciones, Tarjeta, Titulo } from '../components/ui'

const EMOJIS = ['💪', '🔥', '😄', '😴', '🤕', '😅', '🏃', '🏆', '🎯', '❤️', '🙏', '🌧️']

// Mi perfil: foto, estado (24 h), modo día/noche, cambiar PIN y salir.
// La usan el alumno y el entrenador.
export default function Perfil() {
  const { perfil, salir } = useSesion()
  if (!perfil) return null
  return (
    <Pantalla titulo="Mi perfil" volver={perfil.rol === 'entrenador' ? '/alumnos' : '/hoy'}>
      <Foto />
      <EstadoAnimo />
      {perfil.rol === 'alumno' && <AccesosAlumno />}
      <Notificaciones />
      <Tema />
      <CambiarMiPin />
      <Boton variante="borde" className="mt-2" onClick={salir}>
        Cerrar sesión
      </Boton>
      <Firma className="mt-4" />
    </Pantalla>
  )
}

// Mi salud y mis zapatillas (solo alumnos).
function AccesosAlumno() {
  const { alumno } = useMiAlumno()
  const enlaces = [
    ...(alumno.sexo === 'F' ? [{ a: '/ciclo', icono: '🌸', titulo: 'Mi ciclo', texto: 'Calendario, síntomas y privacidad' }] : []),
    { a: '/salud', icono: '❤️', titulo: 'Mi salud', texto: 'Bienestar, molestias, pulso y ficha médica' },
    { a: '/zapatillas', icono: '👟', titulo: 'Mis zapatillas', texto: 'Kilómetros de cada par' },
    { a: '/pagos', icono: '💳', titulo: 'Mis pagos', texto: 'Cuotas e informar transferencias' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {enlaces.map((e) => (
        <Link key={e.a} to={e.a} className="flex flex-col gap-1 rounded-2xl border border-borde bg-superficie p-3 hover:border-azul">
          <span className="text-2xl" aria-hidden="true">
            {e.icono}
          </span>
          <span className="font-semibold">{e.titulo}</span>
          <span className="text-xs text-texto-2">{e.texto}</span>
        </Link>
      ))}
    </div>
  )
}

// Achica la foto a 400×400 (JPEG) antes de subirla: pesa poco y carga rápido.
async function achicar(archivo: File): Promise<Blob> {
  const img = await createImageBitmap(archivo)
  const lado = Math.min(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 400
  canvas.getContext('2d')!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, 400, 400)
  return new Promise((ok, mal) => canvas.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.85))
}

function Foto() {
  const { perfil, recargarPerfil } = useSesion()
  const entrada = useRef<HTMLInputElement>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState('')

  async function elegir(archivo: File | undefined) {
    if (!archivo || !perfil) return
    setError('')
    setSubiendo(true)
    try {
      const blob = await achicar(archivo)
      const ruta = `${perfil.id}/${crypto.randomUUID()}.jpg`
      const { error } = await supabase.storage.from('avatares').upload(ruta, blob, { contentType: 'image/jpeg', upsert: false })
      if (error) throw error
      const url = supabase.storage.from('avatares').getPublicUrl(ruta).data.publicUrl
      // Borrar la foto anterior para no acumular archivos.
      const anterior = perfil.avatar_url?.split('/avatares/')[1]
      const { error: e2 } = await supabase.rpc('set_mi_avatar', { p_url: url })
      if (e2) throw e2
      if (anterior) await supabase.storage.from('avatares').remove([decodeURIComponent(anterior)])
      await recargarPerfil()
    } catch (e) {
      setError(mensajeError(e, 'No se pudo subir la foto. Probá con otra imagen.'))
    } finally {
      setSubiendo(false)
    }
  }

  async function quitar() {
    if (!perfil?.avatar_url || !confirm('¿Quitar tu foto de perfil?')) return
    const anterior = perfil.avatar_url.split('/avatares/')[1]
    await supabase.rpc('set_mi_avatar', { p_url: '' })
    if (anterior) await supabase.storage.from('avatares').remove([decodeURIComponent(anterior)])
    await recargarPerfil()
  }

  if (!perfil) return null
  return (
    <Tarjeta className="flex flex-col items-center gap-3 text-center">
      <div className="relative pt-8">
        <GloboEstado estado={estadoVigente(perfil)} className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap" />
        <Avatar url={perfil.avatar_url} nombre={perfil.nombre} tam={112} />
      </div>
      <div>
        <p className="font-titulo text-xl font-extrabold">{perfil.nombre}</p>
        <p className="text-sm text-texto-2">{perfil.rol === 'entrenador' ? 'Entrenador' : 'Alumno'} · CI {perfil.ci}</p>
      </div>
      <input ref={entrada} type="file" accept="image/*" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      <div className="flex gap-2">
        <Boton onClick={() => entrada.current?.click()} disabled={subiendo}>
          {subiendo ? 'Subiendo…' : perfil.avatar_url ? 'Cambiar foto' : 'Agregar foto'}
        </Boton>
        {perfil.avatar_url && (
          <Boton variante="borde" onClick={quitar}>
            Quitar
          </Boton>
        )}
      </div>
      <MensajeError>{error}</MensajeError>
    </Tarjeta>
  )
}

function EstadoAnimo() {
  const { perfil, recargarPerfil } = useSesion()
  const vigente = perfil ? estadoVigente(perfil) : null
  const [emoji, setEmoji] = useState(vigente?.emoji ?? '')
  const [texto, setTexto] = useState(vigente?.texto ?? '')
  const [cancion, setCancion] = useState(vigente?.cancion ?? '')
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  async function guardar(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    const { error } = await supabase.rpc('set_mi_estado', { p_emoji: emoji, p_texto: texto, p_cancion: cancion })
    if (error) return setError(mensajeError(error))
    setAviso(emoji || texto || cancion ? 'Estado publicado. Se ve durante 24 horas.' : 'Estado borrado.')
    await recargarPerfil()
  }

  async function borrar() {
    setEmoji('')
    setTexto('')
    setCancion('')
    await supabase.rpc('set_mi_estado', { p_emoji: '', p_texto: '', p_cancion: '' })
    setAviso('Estado borrado.')
    await recargarPerfil()
  }

  return (
    <Tarjeta>
      <Titulo>¿Cómo estás hoy?</Titulo>
      <p className="-mt-1 mb-3 text-sm text-texto-2">
        Aparece arriba de tu foto durante 24 horas. {perfil?.rol === 'alumno' ? 'Tu entrenador lo ve.' : 'Tus alumnos lo ven en el chat.'}
      </p>
      <form onSubmit={guardar} className="flex flex-col gap-3">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Emoji</legend>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                aria-label={`Emoji ${e}`}
                onClick={() => setEmoji(emoji === e ? '' : e)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border text-2xl ${emoji === e ? 'border-azul bg-azul/15' : 'border-borde bg-superficie'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </fieldset>
        <Campo id="estado-texto" label="Mensaje" maxLength={80} placeholder="Ej: Lista para el fondo del sábado" value={texto} onChange={(e) => setTexto(e.target.value)} />
        <Campo id="estado-cancion" label="🎵 Canción (opcional)" maxLength={80} placeholder="Ej: Eye of the Tiger – Survivor" value={cancion} onChange={(e) => setCancion(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <MensajeOk>{aviso}</MensajeOk>
        <div className="flex gap-2">
          {vigente && (
            <Boton variante="borde" className="flex-1" onClick={borrar}>
              Borrar
            </Boton>
          )}
          <Boton type="submit" className="flex-1">
            Publicar estado
          </Boton>
        </div>
      </form>
    </Tarjeta>
  )
}

function Notificaciones() {
  const { perfil } = useSesion()
  const [activas, setActivas] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    suscripcionActual().then((s) => setActivas(Boolean(s)))
  }, [])

  async function activar() {
    setError('')
    setTrabajando(true)
    const err = await activarPush()
    setTrabajando(false)
    if (err) return setError(err)
    setActivas(true)
    setAviso('¡Listo! Te mandamos una notificación de prueba.')
    notificar({ tipo: 'prueba' })
  }

  async function desactivar() {
    await desactivarPush()
    setActivas(false)
    setAviso('Notificaciones desactivadas en este celular.')
  }

  return (
    <Tarjeta>
      <Titulo>🔔 Notificaciones</Titulo>
      <p className="-mt-1 mb-3 text-sm text-texto-2">
        {perfil?.rol === 'entrenador'
          ? 'Te avisamos cuando un alumno te escribe, registra una sesión o propone una carrera.'
          : 'Te avisamos cuando tu entrenador publica tu plan, te escribe, evalúa tu sesión o publica un anuncio, y la noche anterior a cada entrenamiento.'}
      </p>
      {!pushSoportado() ? (
        <p className="text-sm text-texto-2">Este navegador no permite notificaciones.</p>
      ) : esIphoneSinInstalar() ? (
        <p className="rounded-xl bg-fondo px-3 py-2 text-sm">
          En iPhone: tocá <strong>Compartir → Agregar a inicio</strong>, abrí la app desde ese ícono y volvé acá para activarlas.
        </p>
      ) : activas ? (
        <Boton variante="borde" onClick={desactivar}>
          Desactivar en este celular
        </Boton>
      ) : (
        <Boton onClick={activar} disabled={trabajando || activas === null}>
          {trabajando ? 'Activando…' : 'Activar notificaciones'}
        </Boton>
      )}
      <MensajeError>{error}</MensajeError>
      <MensajeOk>{aviso}</MensajeOk>
    </Tarjeta>
  )
}

function Tema() {
  const [pref, setPref] = useState<PreferenciaTema>(preferenciaTema())
  return (
    <Tarjeta>
      <Titulo>Pantalla</Titulo>
      <Opciones
        label="Modo"
        valor={pref}
        onChange={(v) => {
          setPref(v)
          guardarTema(v)
        }}
        opciones={[
          { valor: 'claro', texto: '☀️ Día' },
          { valor: 'oscuro', texto: '🌙 Noche' },
          { valor: 'auto', texto: '📱 Automático' },
        ]}
      />
      <p className="mt-2 text-sm text-texto-2">Automático usa el modo de tu celular.</p>
    </Tarjeta>
  )
}

function CambiarMiPin() {
  const [abierto, setAbierto] = useState(false)
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  async function guardar() {
    setError('')
    if (!esPinValido(pin)) return setError('El PIN tiene que tener 6 números.')
    if (pin !== pin2) return setError('Los dos PIN no coinciden.')
    const { error } = await supabase.auth.updateUser({ password: pin })
    if (error) return setError(error.message.includes('different') ? 'Elegí un PIN distinto al actual.' : 'No se pudo cambiar el PIN.')
    setPin('')
    setPin2('')
    setAbierto(false)
    setAviso('PIN cambiado.')
  }

  return (
    <Tarjeta>
      <Titulo accion={!abierto && <Boton variante="texto" onClick={() => setAbierto(true)}>Cambiar</Boton>}>PIN</Titulo>
      <MensajeOk>{aviso}</MensajeOk>
      {abierto && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo id="nuevo-pin" label="PIN nuevo" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
            <Campo id="nuevo-pin2" label="Repetilo" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))} />
          </div>
          <MensajeError>{error}</MensajeError>
          <div className="flex gap-2">
            <Boton variante="borde" className="flex-1" onClick={() => setAbierto(false)}>
              Cancelar
            </Boton>
            <Boton className="flex-1" onClick={guardar}>
              Guardar PIN
            </Boton>
          </div>
        </div>
      )}
    </Tarjeta>
  )
}
