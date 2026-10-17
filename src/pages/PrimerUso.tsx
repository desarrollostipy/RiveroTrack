import { useState, type FormEvent } from 'react'
import { useSesion } from '../lib/sesion'
import { gestionarAcceso } from '../lib/api'
import { esCiValida, esPinValido, limpiarCi } from '../lib/acceso'
import { Pantalla } from '../components/Pantalla'
import { Boton, Campo, MensajeError, Tarjeta } from '../components/ui'

// Se usa una sola vez: crea el acceso del entrenador. Después de creado,
// la función del servidor rechaza cualquier nuevo intento.
export default function PrimerUso() {
  const { ingresar } = useSesion()
  const [codigo, setCodigo] = useState('')
  const [nombre, setNombre] = useState('')
  const [ci, setCi] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!codigo.trim()) return setError('Ingresá el código de instalación.')
    if (!nombre.trim()) return setError('Ingresá el nombre del entrenador.')
    if (!esCiValida(ci)) return setError('La CI tiene que ser solo números.')
    if (!esPinValido(pin)) return setError('El PIN tiene que tener 6 números.')
    if (pin !== pin2) return setError('Los dos PIN no coinciden.')

    setEnviando(true)
    const { error: err } = await gestionarAcceso({
      accion: 'crear-entrenador',
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      ci: limpiarCi(ci),
      pin,
    })
    if (err) {
      setEnviando(false)
      return setError(err)
    }
    const errIngreso = await ingresar(ci, pin)
    setEnviando(false)
    if (errIngreso) setError(errIngreso)
  }

  return (
    <main className="min-h-dvh">
      <Pantalla titulo="Crear acceso del entrenador" subtitulo="Se hace una sola vez" volver="/">
        <Tarjeta className="text-sm text-texto-2">
          En <strong>Código de instalación</strong> escribí el mismo valor que guardaste en Netlify como <strong>CODIGO_INSTALACION</strong>.
        </Tarjeta>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <Campo id="codigo" label="Código de instalación" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          <Campo id="nombre" label="Nombre del entrenador" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Campo
            id="ci"
            label="Número de CI"
            inputMode="numeric"
            autoComplete="username"
            value={ci}
            onChange={(e) => setCi(e.target.value.replace(/\D/g, ''))}
          />
          <Campo
            id="pin"
            label="PIN (6 números)"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          />
          <Campo
            id="pin2"
            label="Repetí el PIN"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={6}
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
          />
          <MensajeError>{error}</MensajeError>
          <Boton type="submit" disabled={enviando}>
            {enviando ? 'Creando…' : 'Crear acceso e ingresar'}
          </Boton>
        </form>
      </Pantalla>
    </main>
  )
}
