import { useMiAlumno } from '../../lib/alumno'
import { Pantalla } from '../../components/Pantalla'
import { Zapatillas } from '../../components/salud/Zapatillas'

export default function MisZapatillas() {
  const { alumno } = useMiAlumno()
  return (
    <Pantalla titulo="Mis zapatillas" volver="/perfil">
      <Zapatillas alumnoId={alumno.id} />
    </Pantalla>
  )
}
