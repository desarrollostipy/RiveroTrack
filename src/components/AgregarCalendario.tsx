import { useState } from 'react'
import { archivoCalendario, descargar, guardarHora, horaGuardada } from '../lib/calendario'
import type { SemanaCompleta } from '../lib/tipos'
import { useTipos } from './Semana'
import { Boton, Campo, Hoja } from './ui'

/** "📅 Agregar al calendario": baja un archivo que el celular agrega a su calendario. */
export function AgregarCalendario({ semana, lunes }: { semana: SemanaCompleta; lunes: string }) {
  const { tipo } = useTipos()
  const [abierta, setAbierta] = useState(false)
  const [hora, setHora] = useState(horaGuardada())
  const [tarde, setTarde] = useState('18:00')
  const hayDobleTurno = semana.sesiones.some((s) => s.turno === 2)
  const cantidad = semana.sesiones.filter((s) => s.tipo !== 'descanso').length
  if (!cantidad) return null

  function bajar() {
    guardarHora(hora)
    const ics = archivoCalendario(
      semana.sesiones.map((s) => ({ ...s, nombreTipo: tipo(s.tipo).nombre })),
      hora,
      tarde,
    )
    descargar(`rivero-semana-${lunes}.ics`, ics)
    setAbierta(false)
  }

  return (
    <>
      <Boton variante="borde" onClick={() => setAbierta(true)}>
        📅 Agregar al calendario del celular
      </Boton>
      <Hoja titulo="Agregar al calendario" abierta={abierta} onCerrar={() => setAbierta(false)}>
        <p className="text-sm text-texto-2">
          Se agregan los {cantidad} entrenamientos de esta semana, con aviso 30 minutos antes. Al abrir el archivo, tu celular te pregunta en qué
          calendario guardarlos.
        </p>
        <Campo id="cal-hora" label={hayDobleTurno ? 'Hora del turno mañana' : '¿A qué hora entrenás?'} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        {hayDobleTurno && <Campo id="cal-tarde" label="Hora del turno tarde" type="time" value={tarde} onChange={(e) => setTarde(e.target.value)} />}
        <Boton onClick={bajar}>Agregar {cantidad} entrenamientos</Boton>
      </Hoja>
    </>
  )
}
