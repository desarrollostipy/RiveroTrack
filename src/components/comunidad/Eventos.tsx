import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { DIAS, diaSemana, diasEntre, hoyPY } from '../../lib/fechas'
import { formatoFecha, formatoGs } from '../../lib/formato'
import type { CupoEvento, Evento } from '../../lib/comunidad'
import { Boton, MensajeError, Tarjeta, Titulo } from '../ui'

export function textoFechaEvento(e: Pick<Evento, 'fecha' | 'hora'>) {
  return `${DIAS[diaSemana(e.fecha)]} ${formatoFecha(e.fecha)}${e.hora ? ` · ${e.hora.slice(0, 5)}` : ''}`
}

export function useEventos() {
  const hoy = hoyPY()
  const [eventos, setEventos] = useState<Evento[] | null>(null)
  const [cupos, setCupos] = useState<Record<string, CupoEvento>>({})
  const cargar = useCallback(async () => {
    const [e, c] = await Promise.all([supabase.from('eventos').select('*').gte('fecha', hoy).order('fecha'), supabase.rpc('cupos_eventos')])
    setEventos((e.data ?? []) as Evento[])
    setCupos(Object.fromEntries(((c.data ?? []) as CupoEvento[]).map((x) => [x.evento_id, x])))
  }, [hoy])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { eventos, cupos, cargar }
}

/** Eventos del grupo: fondos especiales, viajes a carreras… con cupo e inscripción. */
export function EventosAlumno({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const { eventos, cupos, cargar } = useEventos()
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)

  if (!eventos || eventos.length === 0) return null

  async function anotarme(e: Evento) {
    setTrabajando(e.id)
    setError('')
    const { error } = await supabase.rpc('inscribirme_evento', { p_evento_id: e.id })
    setTrabajando(null)
    if (error) return setError(mensajeError(error, error.message))
    cargar()
  }

  async function bajarme(e: Evento) {
    if (!confirm(`¿Darte de baja de "${e.titulo}"?`)) return
    setTrabajando(e.id)
    await supabase.from('inscripciones_evento').delete().eq('evento_id', e.id).eq('alumno_id', alumnoId)
    setTrabajando(null)
    cargar()
  }

  return (
    <Tarjeta>
      <Titulo>📅 Eventos del grupo</Titulo>
      <MensajeError>{error}</MensajeError>
      <ul className="flex flex-col gap-2">
        {eventos.map((e) => {
          const c = cupos[e.id]
          const anotados = c?.anotados ?? 0
          const quedan = e.cupo ? Math.max(0, e.cupo - anotados) : null
          const cerrado = !!e.cierre && e.cierre < hoy
          const lleno = quedan === 0
          return (
            <li key={e.id} className={`rounded-2xl border-2 p-3 ${c?.yo ? 'border-ok bg-ok/5' : 'border-borde'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{e.titulo}</p>
                  <p className="text-sm text-texto-2">
                    {textoFechaEvento(e)}
                    {e.lugar ? ` · ${e.lugar}` : ''}
                  </p>
                </div>
                <span className="shrink-0 rounded-xl bg-azul/10 px-2 py-1 text-center text-azul">
                  <span className="block font-titulo text-lg font-extrabold leading-none">{diasEntre(hoy, e.fecha)}</span>
                  <span className="text-[0.6rem] font-semibold">días</span>
                </span>
              </div>
              {e.descripcion && <p className="mt-1 whitespace-pre-line text-sm">{e.descripcion}</p>}
              <p className="mt-1 text-sm text-texto-2">
                {anotados} anotado{anotados === 1 ? '' : 's'}
                {quedan !== null && ` · ${quedan === 0 ? 'sin lugares' : `quedan ${quedan}`}`}
                {e.costo ? ` · ${formatoGs(e.costo)}` : ' · gratis'}
                {e.cierre && !cerrado ? ` · anotarse hasta el ${formatoFecha(e.cierre)}` : ''}
              </p>
              <div className="mt-2">
                {c?.yo ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-ok">✓ Estás anotado</span>
                    <Boton variante="texto" disabled={trabajando === e.id} onClick={() => bajarme(e)}>
                      Darme de baja
                    </Boton>
                  </div>
                ) : cerrado ? (
                  <p className="text-sm font-semibold text-texto-2">Inscripciones cerradas</p>
                ) : (
                  <Boton className="w-full" disabled={lleno || trabajando === e.id} onClick={() => anotarme(e)}>
                    {lleno ? 'Sin lugares' : trabajando === e.id ? 'Anotando…' : '🙋 Anotarme'}
                  </Boton>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}
