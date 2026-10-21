import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useSesion } from '../lib/sesion'
import { esPinValido } from '../lib/acceso'
import { Pantalla } from '../components/Pantalla'
import { Boton, Campo, MensajeError } from '../components/ui'

// Primer ingreso (o después de un reseteo): el alumno reemplaza el PIN
// aleatorio que le dio el entrenador por uno propio.
export default function CambiarPin() {
  const { perfil, recargarPerfil, salir } = useSesion()
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!esPinValido(pin)) return setError('El PIN tiene que tener 6 números.')
    if (pin !== pin2) return setError('Los dos PIN no coinciden.')

    setEnviando(true)
    const { error: err } = await supabase.auth.updateUser({ password: pin })
    if (err) {
      setEnviando(false)
      return setError(
        err.message.includes('different')
          ? 'Elegí un PIN distinto al que te dio tu entrenador.'
          : 'No se pudo guardar el PIN. Intentá de nuevo.',
      )
    }
    await supabase.rpc('marcar_clave_cambiada')
    await recargarPerfil()
    setEnviando(false)
  }

  return (
    <main className="min-h-dvh">
      <Pantalla
        titulo="Elegí tu PIN"
        subtitulo={`Hola, ${perfil?.nombre.split(' ')[0] ?? ''}`}
        derecha={
          <Boton variante="borde" onClick={salir}>
            Salir
          </Boton>
        }
      >
        <p className="text-texto-2">
          Reemplazá el PIN que te dio tu entrenador por uno de 6 números que solo vos conozcas.
        </p>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <Campo
            id="pin"
            label="PIN nuevo"
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
            {enviando ? 'Guardando…' : 'Guardar PIN'}
          </Boton>
        </form>
      </Pantalla>
    </main>
  )
}
