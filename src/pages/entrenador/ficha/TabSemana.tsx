import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../../lib/supabase'
import { cargarSemanas, mensajeError } from '../../../lib/consultas'
import { resumenSemana } from '../../../lib/calculos'
import { hoyPY, lunesDe, rangoSemana, sumarDias } from '../../../lib/fechas'
import { formatoKm } from '../../../lib/formato'
import type { SemanaCompleta } from '../../../lib/tipos'
import { ListaDias } from '../../../components/Semana'
import { AreaTexto, Boton, Cargando, MensajeError, MensajeOk, SelectorPeriodo, Tarjeta, Titulo, Vacio } from '../../../components/ui'

export function TabSemana({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const [semana, setSemana] = useState<SemanaCompleta | null | undefined>(undefined)

  const cargar = useCallback(async () => {
    setSemana(undefined)
    const [s] = await cargarSemanas({ alumnoId, desde: lunes, hasta: lunes })
    setSemana(s ?? null)
  }, [alumnoId, lunes])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    const canal = supabase
      .channel(`ficha-${alumnoId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sesiones_registradas', filter: `alumno_id=eq.${alumnoId}` }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [alumnoId, cargar])

  const r = semana ? resumenSemana(semana.sesiones) : null

  return (
    <div className="flex flex-col gap-3">
      <SelectorPeriodo
        texto={rangoSemana(lunes)}
        detalle={semana === undefined ? '' : semana ? (semana.estado === 'publicado' ? 'Publicado · el alumno lo ve' : 'Borrador · el alumno no lo ve') : 'Sin plan'}
        onAnterior={() => setLunes(sumarDias(lunes, -7))}
        onSiguiente={() => setLunes(sumarDias(lunes, 7))}
      />
      {r && (
        <p className="text-sm text-texto-2">
          <span className="font-mono font-semibold text-tinta">
            {formatoKm(r.kmReal)} / {r.estimado ? '≈' : ''}
            {formatoKm(r.kmPlan)} km
          </span>{' '}
          · {r.hechas}/{r.plan} sesiones
        </p>
      )}
      {semana?.nota_semana && <Tarjeta className="text-sm">📌 {semana.nota_semana}</Tarjeta>}

      <Link
        to={`/alumnos/${alumnoId}/plan?semana=${lunes}`}
        className="flex min-h-11 items-center justify-center rounded-xl bg-azul px-4 font-semibold text-white hover:bg-azul-hover"
      >
        {semana ? 'Editar plan' : 'Armar plan de esta semana'}
      </Link>

      {semana === undefined && <Cargando />}
      {semana === null && <Vacio>No hay plan para esta semana.</Vacio>}
      {semana && (
        <ListaDias
          lunes={lunes}
          sesiones={semana.sesiones}
          hoy={hoy}
          accion={(s) =>
            s.registro && !s.evaluacion ? (
              <Link to={`/evaluar/${s.id}`} className="flex min-h-11 items-center rounded-xl bg-azul px-4 text-sm font-semibold text-white">
                Evaluar
              </Link>
            ) : s.evaluacion || (s.fecha < hoy && !s.registro) ? (
              <Link to={`/evaluar/${s.id}`} className="flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-azul hover:bg-azul/10">
                {s.evaluacion ? 'Ver / editar' : 'Comentar'}
              </Link>
            ) : null
          }
        />
      )}

      <NotasPrivadas alumnoId={alumnoId} />
    </div>
  )
}

function NotasPrivadas({ alumnoId }: { alumnoId: string }) {
  const [notas, setNotas] = useState('')
  const [estado, setEstado] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('notas_privadas')
      .select('notas')
      .eq('alumno_id', alumnoId)
      .maybeSingle()
      .then(({ data }) => setNotas(data?.notas ?? ''))
  }, [alumnoId])

  async function guardar() {
    setError('')
    const { error } = await supabase.from('notas_privadas').upsert({ alumno_id: alumnoId, notas: notas.trim() })
    if (error) setError(mensajeError(error))
    else setEstado('Notas guardadas.')
  }

  return (
    <Tarjeta className="mt-2 border-marino/20 bg-marino/5">
      <Titulo>🔒 Notas privadas</Titulo>
      <p className="mb-2 text-sm text-texto-2">Solo las ves vos. El alumno no puede leerlas.</p>
      <AreaTexto id="notas-privadas" label="Notas" value={notas} onChange={(e) => (setNotas(e.target.value), setEstado(''))} rows={4} />
      <div className="mt-2 flex items-center gap-3">
        <Boton variante="oscuro" onClick={guardar}>
          Guardar notas
        </Boton>
        <MensajeOk>{estado}</MensajeOk>
      </div>
      <MensajeError>{error}</MensajeError>
    </Tarjeta>
  )
}
