import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { Pantalla } from '../../components/Pantalla'
import { EnConstruccion } from '../../components/ui'

export default function FichaAlumno() {
  const { id } = useParams()
  const [nombre, setNombre] = useState('')

  useEffect(() => {
    supabase
      .from('alumnos')
      .select('nombre')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => setNombre(data?.nombre ?? 'Alumno'))
  }, [id])

  return (
    <Pantalla titulo={nombre || '…'} volver="/alumnos">
      <EnConstruccion etapa={1}>
        Datos físicos, marcas, próxima competencia, estado de pago y pestañas Semana · Pagos · Evolución.
      </EnConstruccion>
    </Pantalla>
  )
}
