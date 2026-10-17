import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { hoyPY, lunesDe, rangoSemana } from '../../lib/fechas'
import { Pantalla } from '../../components/Pantalla'
import { Boton, EnConstruccion, MensajeError, Tarjeta } from '../../components/ui'

type FilaAlumno = { id: string; nombre: string; objetivo: string | null; nivel: string }

export default function Alumnos() {
  const { salir } = useSesion()
  const [alumnos, setAlumnos] = useState<FilaAlumno[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('alumnos')
      .select('id, nombre, objetivo, nivel')
      .eq('activo', true)
      .order('nombre')
      .then(({ data, error }) => {
        if (error) setError('No se pudo cargar la lista de alumnos.')
        else setAlumnos(data)
      })
  }, [])

  return (
    <Pantalla
      titulo="Alumnos"
      subtitulo={`Semana ${rangoSemana(lunesDe(hoyPY()))}`}
      derecha={
        <Boton variante="borde" onClick={salir}>
          Salir
        </Boton>
      }
    >
      <EnConstruccion etapa={1}>
        Indicadores de la semana, filtros, estado día por día, cuotas y alta de alumnos.
      </EnConstruccion>

      <MensajeError>{error}</MensajeError>
      {alumnos === null && !error && <p className="text-texto-2">Cargando…</p>}
      {alumnos?.length === 0 && <p className="text-texto-2">Todavía no hay alumnos cargados.</p>}

      <ul className="flex flex-col gap-2">
        {alumnos?.map((a) => (
          <li key={a.id}>
            <Link to={`/alumnos/${a.id}`} className="block rounded-2xl">
              <Tarjeta className="hover:border-azul">
                <p className="font-semibold">{a.nombre}</p>
                <p className="text-sm text-texto-2">{a.objetivo ?? 'Sin objetivo cargado'}</p>
              </Tarjeta>
            </Link>
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}
