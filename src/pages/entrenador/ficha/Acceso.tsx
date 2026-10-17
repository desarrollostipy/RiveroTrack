import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { supabase } from '../../../lib/supabase'
import { gestionarAcceso } from '../../../lib/api'
import { esCiValida, limpiarCi } from '../../../lib/acceso'
import type { Alumno } from '../../../lib/tipos'
import { Boton, Campo, Hoja, MensajeError, MensajeOk, Tarjeta, Titulo } from '../../../components/ui'

export type EstadoAcceso = { pin?: string; ci?: string; errorAcceso?: string }

// Crear el acceso del alumno (CI + PIN aleatorio) y resetear el PIN.
// Si el acceso se creó al dar de alta, llega el PIN para mostrarlo acá.
export function Acceso({ alumno, onCambio }: { alumno: Alumno; onCambio: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const recibido = (location.state ?? {}) as EstadoAcceso
  const [ci, setCi] = useState(recibido.errorAcceso ? (recibido.ci ?? '') : '')
  const [ciActual, setCiActual] = useState<string | null>(null)
  const [error, setError] = useState(recibido.errorAcceso ?? '')
  const [trabajando, setTrabajando] = useState(false)
  const [pin, setPin] = useState<{ pin: string; ci: string } | null>(recibido.pin ? { pin: recibido.pin, ci: recibido.ci ?? '' } : null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    if (!alumno.profile_id) return setCiActual(null)
    supabase
      .from('profiles')
      .select('ci')
      .eq('id', alumno.profile_id)
      .maybeSingle()
      .then(({ data }) => setCiActual(data?.ci ?? null))
  }, [alumno.profile_id])

  async function crear() {
    setError('')
    if (!esCiValida(ci)) return setError('Ingresá la CI, solo números.')
    setTrabajando(true)
    const r = await gestionarAcceso<{ pin: string }>({ accion: 'crear-acceso', alumno_id: alumno.id, ci: limpiarCi(ci) })
    setTrabajando(false)
    if (r.error !== null) return setError(r.error)
    setPin({ pin: r.datos.pin, ci: limpiarCi(ci) })
    setCi('')
    onCambio()
  }

  async function resetear() {
    if (!confirm(`¿Resetear el PIN de ${alumno.nombre}? Se genera uno nuevo y el anterior deja de funcionar.`)) return
    setError('')
    setTrabajando(true)
    const r = await gestionarAcceso<{ pin: string }>({ accion: 'resetear-pin', alumno_id: alumno.id })
    setTrabajando(false)
    if (r.error !== null) return setError(r.error)
    setPin({ pin: r.datos.pin, ci: ciActual ?? '' })
  }

  const mensaje = pin
    ? `Hola ${alumno.nombre.split(' ')[0]}! Tu acceso a la app de Rivero Track & Field:\n${window.location.origin}\nCI: ${pin.ci}\nPIN temporal: ${pin.pin}\nAl entrar vas a elegir tu propio PIN.`
    : ''

  return (
    <Tarjeta>
      <Titulo>Acceso a la app</Titulo>
      {alumno.profile_id ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-2">
            Tiene acceso{ciActual ? ` con CI ${ciActual}` : ''}. Si olvidó su PIN, generá uno nuevo.
          </p>
          <Boton variante="borde" onClick={resetear} disabled={trabajando}>
            {trabajando ? 'Generando…' : 'Resetear PIN'}
          </Boton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-texto-2">Todavía no tiene acceso. Cargá su CI y la app genera un PIN temporal.</p>
          <div className="flex items-end gap-2">
            <Campo id="ci-acceso" label="Número de CI" inputMode="numeric" value={ci} onChange={(e) => setCi(e.target.value.replace(/\D/g, ''))} className="flex-1" />
            <Boton onClick={crear} disabled={trabajando}>
              {trabajando ? 'Creando…' : 'Crear acceso'}
            </Boton>
          </div>
        </div>
      )}
      <MensajeError>{error}</MensajeError>

      <Hoja
        titulo="PIN temporal"
        abierta={!!pin}
        onCerrar={() => {
          setPin(null)
          setCopiado(false)
          // Que el PIN no vuelva a aparecer si se recarga la página.
          if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
        }}
      >
        <p className="text-texto-2">Pasale estos datos a {alumno.nombre.split(' ')[0]}. Al ingresar, va a tener que elegir su propio PIN.</p>
        <div className="rounded-2xl bg-white p-4 text-center">
          <p className="text-sm text-texto-2">CI {pin?.ci}</p>
          <p className="font-mono text-4xl font-semibold tracking-[0.3em]">{pin?.pin}</p>
        </div>
        <Boton
          onClick={async () => {
            await navigator.clipboard.writeText(mensaje)
            setCopiado(true)
          }}
        >
          Copiar mensaje para WhatsApp
        </Boton>
        <MensajeOk>{copiado ? 'Mensaje copiado. Pegalo en el chat del alumno.' : ''}</MensajeOk>
        <p className="text-xs text-texto-2">Este PIN no se vuelve a mostrar. Si se pierde, reseteálo.</p>
      </Hoja>
    </Tarjeta>
  )
}
