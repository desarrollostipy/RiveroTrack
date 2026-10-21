import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { mensajeError } from '../../lib/consultas'
import { estimarCiclo } from '../../lib/calculos'
import { hoyPY } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import type { Ciclo } from '../../lib/tipos'
import { Boton, MensajeError } from '../../components/ui'

// Solo alumnas. Dato de salud: el entrenador lo ve solo si ella comparte.
export function MiCiclo() {
  const { alumno, recargar } = useMiAlumno()
  const hoy = hoyPY()
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [error, setError] = useState('')
  const [editando, setEditando] = useState<string | null>(null)
  const [fechaEdit, setFechaEdit] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('ciclos_menstruales').select('*').eq('alumno_id', alumno.id).order('fecha_inicio', { ascending: false })
    setCiclos((data ?? []) as Ciclo[])
  }, [alumno.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  const estimado = estimarCiclo(
    ciclos.map((c) => c.fecha_inicio),
    hoy,
  )

  async function meVinoHoy() {
    setError('')
    const { error } = await supabase.from('ciclos_menstruales').insert({ alumno_id: alumno.id, fecha_inicio: hoy })
    if (error) return setError(error.code === '23505' ? 'Ya registraste un inicio hoy.' : mensajeError(error))
    cargar()
  }

  async function compartir(valor: boolean) {
    const { error } = await supabase.rpc('set_comparte_ciclo', { p_comparte: valor })
    if (error) return setError(mensajeError(error))
    recargar()
  }

  async function guardarFecha(c: Ciclo) {
    if (!fechaEdit || fechaEdit > hoy) return setError('Elegí una fecha válida (no futura).')
    const { error } = await supabase.from('ciclos_menstruales').update({ fecha_inicio: fechaEdit }).eq('id', c.id)
    if (error) return setError(mensajeError(error))
    setEditando(null)
    cargar()
  }

  async function borrar(c: Ciclo) {
    if (!confirm(`¿Borrar el registro del ${formatoFecha(c.fecha_inicio)}?`)) return
    await supabase.from('ciclos_menstruales').delete().eq('id', c.id)
    cargar()
  }

  return (
    <section className="rounded-2xl border border-ciclo/20 bg-ciclo-fondo p-4 text-ciclo" aria-labelledby="titulo-ciclo">
      <h2 id="titulo-ciclo" className="font-titulo text-lg font-extrabold">
        Mi ciclo
      </h2>
      {estimado ? (
        <>
          <p className="mt-1 text-xl font-semibold">
            Día {estimado.dia} · fase {estimado.fase}
          </p>
          <p className="text-sm">
            Estimado · próximo período {estimado.atrasado ? `esperado el ${formatoFecha(estimado.proximo)}` : `~${formatoFecha(estimado.proximo)}`} (ciclo de{' '}
            {estimado.duracion} días)
          </p>
        </>
      ) : (
        <p className="mt-1 text-sm">Registrá el inicio de tu período para ver el día y la fase estimados.</p>
      )}

      <Boton onClick={meVinoHoy} className="mt-3 w-full !bg-ciclo text-white hover:!bg-ciclo/90">
        Me vino hoy
      </Boton>

      <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2">
        <span>
          <span className="block font-semibold">Compartir con mi entrenador</span>
          <span className="text-sm">{alumno.comparte_ciclo ? 'Tu entrenador ve el día y la fase para ajustar tu plan' : 'Solo lo ves vos'}</span>
        </span>
        <input type="checkbox" role="switch" className="h-6 w-6 accent-ciclo" checked={alumno.comparte_ciclo} onChange={(e) => compartir(e.target.checked)} />
      </label>

      <MensajeError>{error}</MensajeError>

      {ciclos.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Mis registros ({ciclos.length})</summary>
          <ul className="flex flex-col divide-y divide-ciclo/20">
            {ciclos.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-1">
                {editando === c.id ? (
                  <>
                    <input
                      type="date"
                      aria-label="Fecha de inicio"
                      className="min-h-11 rounded-xl border border-borde bg-superficie px-2 text-tinta"
                      value={fechaEdit}
                      max={hoy}
                      onChange={(e) => setFechaEdit(e.target.value)}
                    />
                    <span className="flex gap-1">
                      <Boton variante="borde" onClick={() => setEditando(null)}>
                        Cancelar
                      </Boton>
                      <Boton onClick={() => guardarFecha(c)}>Guardar</Boton>
                    </span>
                  </>
                ) : (
                  <>
                    <span>Inicio {formatoFecha(c.fecha_inicio)}/{c.fecha_inicio.slice(2, 4)}</span>
                    <span className="flex gap-1">
                      <Boton variante="texto" onClick={() => (setEditando(c.id), setFechaEdit(c.fecha_inicio))}>
                        Corregir
                      </Boton>
                      <Boton variante="texto" onClick={() => borrar(c)}>
                        Borrar
                      </Boton>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
