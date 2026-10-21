import type { Alumno } from '../../../lib/tipos'
import { useHistorial } from '../../../components/Logros'
import { HistorialBienestar } from '../../../components/salud/Bienestar'
import { Molestias } from '../../../components/salud/Molestias'
import { ZonasPulso } from '../../../components/salud/Pulso'
import { FichaMedica } from '../../../components/salud/FichaMedica'
import { Zapatillas } from '../../../components/salud/Zapatillas'
import { Metas } from '../../../components/salud/Metas'

/** Ficha del alumno → Salud: lo que el alumno cuenta y carga, para que el entrenador ajuste el plan. */
export function TabSalud({ alumno, onCambio }: { alumno: Alumno; onCambio: () => void }) {
  const h = useHistorial(alumno.id)
  return (
    <div className="flex flex-col gap-3">
      <HistorialBienestar alumnoId={alumno.id} />
      <Molestias alumnoId={alumno.id} />
      <FichaMedica alumnoId={alumno.id} />
      <ZonasPulso alumno={alumno} modo="entrenador" onCambio={onCambio} />
      {h && <Metas alumnoId={alumno.id} h={h} editable={false} />}
      <Zapatillas alumnoId={alumno.id} editable={false} />
    </div>
  )
}
