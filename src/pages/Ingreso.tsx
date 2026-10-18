import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { useSesion } from '../lib/sesion'
import { esCiValida, esPinValido } from '../lib/acceso'
import { Boton, Campo, Logo, MensajeError } from '../components/ui'

export default function Ingreso() {
  const { ingresar } = useSesion()
  const [ci, setCi] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [hayEntrenador, setHayEntrenador] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.rpc('hay_entrenador').then(({ data, error }) => setHayEntrenador(error ? null : Boolean(data)))
  }, [])

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!esCiValida(ci)) return setError('Ingresá tu número de CI, solo números.')
    if (!esPinValido(pin)) return setError('El PIN tiene 6 números.')
    setEnviando(true)
    const err = await ingresar(ci, pin)
    setEnviando(false)
    if (err) setError(err)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <Logo className="mx-auto h-32 text-5xl" />

      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
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
          label="PIN"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        <MensajeError>{error}</MensajeError>
        <Boton type="submit" disabled={enviando} className="mt-2">
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Boton>
      </form>

      <p className="text-center text-sm text-texto-2">
        ¿Olvidaste tu PIN? Pedile a tu entrenador que te lo resetee.
      </p>

      {hayEntrenador !== false && (
        <Link
          to="/registro"
          className="flex min-h-12 items-center justify-center rounded-xl border-2 border-marino px-4 text-center font-semibold text-marino hover:bg-marino hover:text-white"
        >
          Soy alumno nuevo · Registrarme
        </Link>
      )}

      {hayEntrenador === false && (
        <Link
          to="/primer-uso"
          className="flex min-h-11 items-center justify-center rounded-xl border border-dashed border-azul px-4 text-center font-semibold text-azul"
        >
          Primer uso: crear el acceso del entrenador
        </Link>
      )}
    </main>
  )
}
