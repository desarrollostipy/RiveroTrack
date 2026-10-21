import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import type { Alumno } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { EvolucionAlumno } from '../../components/EvolucionAlumno'
import { Cargando, Selector, Vacio } from '../../components/ui'

export default function Evolucion() {
  const [params, setParams] = useSearchParams()
  const [alumnos, setAlumnos] = useState<Pick<Alumno, 'id' | 'nombre'>[] | null>(null)
  const elegido = params.get('alumno') ?? alumnos?.[0]?.id ?? ''

  useEffect(() => {
    supabase
      .from('alumnos')
      .select('id, nombre')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setAlumnos((data ?? []) as Alumno[]))
  }, [])

  return (
    <Pantalla titulo="Evolución">
      {alumnos === null && <Cargando />}
      {alumnos?.length === 0 && <Vacio>Todavía no hay alumnos.</Vacio>}
      {alumnos && alumnos.length > 0 && (
        <>
          <Selector id="evo-alumno" label="Alumno" value={elegido} onChange={(e) => setParams({ alumno: e.target.value }, { replace: true })}>
            {alumnos.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Selector>
          {elegido && <EvolucionAlumno alumnoId={elegido} />}
        </>
      )}
    </Pantalla>
  )
}
