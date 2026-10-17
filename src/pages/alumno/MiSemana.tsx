import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMiAlumno } from '../../lib/alumno'
import { cargarSemanas } from '../../lib/consultas'
import { resumenSemana } from '../../lib/calculos'
import { hoyPY, lunesDe, rangoSemana, sumarDias } from '../../lib/fechas'
import { formatoKm } from '../../lib/formato'
import type { SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { ListaDias } from '../../components/Semana'
import { Cargando, Indicador, SelectorPeriodo, Tarjeta, Vacio } from '../../components/ui'

export default function MiSemana() {
  const { alumno } = useMiAlumno()
  const hoy = hoyPY()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const [semana, setSemana] = useState<SemanaCompleta | null | undefined>(undefined)

  useEffect(() => {
    setSemana(undefined)
    cargarSemanas({ alumnoId: alumno.id, desde: lunes, hasta: lunes }).then(([s]) => setSemana(s ?? null))
  }, [alumno.id, lunes])

  const r = semana ? resumenSemana(semana.sesiones) : null
  const semanaActual = lunesDe(hoy)

  return (
    <Pantalla titulo="Mi semana">
      <SelectorPeriodo
        texto={rangoSemana(lunes)}
        detalle={lunes === semanaActual ? 'Semana actual' : lunes < semanaActual ? 'Semana anterior' : 'Próxima semana'}
        onAnterior={() => setLunes(sumarDias(lunes, -7))}
        onSiguiente={() => setLunes(sumarDias(lunes, 7))}
      />
      {semana === undefined && <Cargando />}
      {semana === null && <Vacio>{lunes > semanaActual ? 'Tu entrenador todavía no publicó este plan.' : 'No hay plan publicado para esta semana.'}</Vacio>}
      {semana && r && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Indicador valor={`${formatoKm(r.kmReal)} / ${r.estimado ? '≈' : ''}${formatoKm(r.kmPlan)}`} texto="km hechos / planificados" />
            <Indicador valor={`${r.hechas}/${r.plan}`} texto="sesiones hechas" tono="azul" />
          </div>
          {semana.nota_semana && <Tarjeta>📌 {semana.nota_semana}</Tarjeta>}
          <ListaDias
            lunes={lunes}
            sesiones={semana.sesiones}
            hoy={hoy}
            accion={(s) =>
              // Se puede registrar hoy y los días anteriores de la semana que falten.
              s.fecha <= hoy && s.fecha >= sumarDias(hoy, -6) ? (
                <Link
                  to={`/registrar/${s.id}`}
                  className={`flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${s.registro ? 'text-azul' : 'bg-azul text-white'}`}
                >
                  {s.registro ? 'Editar' : 'Registrar'}
                </Link>
              ) : null
            }
            extra={(s) => (s.evaluacion?.comentario ? <p className="rounded-xl bg-fondo px-3 py-2 text-sm">💬 {s.evaluacion.comentario}</p> : null)}
          />
        </>
      )}
    </Pantalla>
  )
}
