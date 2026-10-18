import { useState, type FormEvent } from 'react'
import { useSesion } from '../lib/sesion'
import { gestionarAcceso } from '../lib/api'
import { esCiValida, esPinValido, limpiarCi } from '../lib/acceso'
import { leerNumero } from '../lib/formato'
import type { Nivel } from '../lib/tipos'
import { Pantalla } from '../components/Pantalla'
import { AreaTexto, Boton, Campo, MensajeError, Opciones, Tarjeta } from '../components/ui'

// Registro de alumnos nuevos desde la pantalla de ingreso.
// Queda pendiente hasta que el entrenador lo acepta.
export default function Registro() {
  const { ingresar } = useSesion()
  const [nombre, setNombre] = useState('')
  const [ci, setCi] = useState('')
  const [telefono, setTelefono] = useState('')
  const [sexo, setSexo] = useState<'F' | 'M' | null>(null)
  const [nacimiento, setNacimiento] = useState('')
  const [nivel, setNivel] = useState<Nivel | null>(null)
  const [objetivo, setObjetivo] = useState('')
  const [altura, setAltura] = useState('')
  const [peso, setPeso] = useState('')
  const [comentario, setComentario] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (nombre.trim().length < 3) return setError('Ingresá tu nombre y apellido.')
    if (!esCiValida(ci)) return setError('Ingresá tu número de CI, solo números.')
    if (!sexo) return setError('Elegí tu sexo.')
    if (!esPinValido(pin)) return setError('El PIN tiene que tener 6 números.')
    if (pin !== pin2) return setError('Los dos PIN no coinciden.')

    setEnviando(true)
    const r = await gestionarAcceso({
      accion: 'solicitar-alta',
      nombre: nombre.trim(),
      ci: limpiarCi(ci),
      pin,
      sexo,
      fecha_nacimiento: nacimiento || null,
      telefono: telefono.trim() || null,
      objetivo: objetivo.trim() || null,
      nivel,
      altura_cm: leerNumero(altura),
      peso_kg: leerNumero(peso),
      comentario: comentario.trim() || null,
    })
    if (r.error !== null) {
      setEnviando(false)
      return setError(r.error)
    }
    // Entra directo: va a ver "Solicitud pendiente" hasta que lo acepten.
    const err = await ingresar(ci, pin)
    setEnviando(false)
    if (err) setError(err)
  }

  return (
    <main className="min-h-dvh">
      <Pantalla titulo="Soy alumno nuevo" subtitulo="Completá tus datos y tu entrenador te da de alta" volver="/">
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <Campo id="r-nombre" label="Nombre y apellido" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Campo
            id="r-ci"
            label="Número de CI"
            inputMode="numeric"
            autoComplete="username"
            value={ci}
            onChange={(e) => setCi(e.target.value.replace(/\D/g, ''))}
            ayuda="Con tu CI vas a ingresar a la app."
          />
          <Campo id="r-tel" label="Celular (opcional)" type="tel" inputMode="tel" autoComplete="tel" placeholder="0981 123 456" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <Opciones
            label="Sexo"
            valor={sexo}
            onChange={setSexo}
            opciones={[
              { valor: 'F', texto: 'Femenino' },
              { valor: 'M', texto: 'Masculino' },
            ]}
          />
          <Campo id="r-nac" label="Fecha de nacimiento (opcional)" type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
          <Opciones
            label="¿Cómo te considerás? (opcional)"
            valor={nivel}
            onChange={(v) => setNivel(v === nivel ? null : v)}
            opciones={[
              { valor: 'principiante', texto: 'Empiezo a correr' },
              { valor: 'intermedio', texto: 'Corro seguido' },
              { valor: 'avanzado', texto: 'Compito' },
            ]}
          />
          <Campo id="r-obj" label="Tu objetivo (opcional)" placeholder="Ej: correr mi primer 10K" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Campo id="r-alt" label="Altura en cm (opcional)" inputMode="numeric" value={altura} onChange={(e) => setAltura(e.target.value.replace(/\D/g, ''))} />
            <Campo id="r-peso" label="Peso en kg (opcional)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
          </div>
          <AreaTexto
            id="r-com"
            label="¿Algo que tu entrenador deba saber? (opcional)"
            placeholder="Lesiones, horarios, carreras que ya corriste…"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />

          <Tarjeta className="flex flex-col gap-3 border-azul/30">
            <p className="font-semibold">Elegí tu PIN</p>
            <p className="-mt-2 text-sm text-texto-2">6 números que solo vos conozcas. Lo vas a usar con tu CI para ingresar.</p>
            <div className="grid grid-cols-2 gap-3">
              <Campo
                id="r-pin"
                label="PIN"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              />
              <Campo
                id="r-pin2"
                label="Repetí el PIN"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                maxLength={6}
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
              />
            </div>
          </Tarjeta>

          <MensajeError>{error}</MensajeError>
          <Boton type="submit" disabled={enviando} className="min-h-12">
            {enviando ? 'Enviando…' : 'Enviar solicitud'}
          </Boton>
        </form>
      </Pantalla>
    </main>
  )
}
