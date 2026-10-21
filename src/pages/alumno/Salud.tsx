import { useSearchParams } from 'react-router'
import { useMiAlumno } from '../../lib/alumno'
import { Pantalla } from '../../components/Pantalla'
import { Pestanas } from '../../components/ui'
import { HistorialBienestar } from '../../components/salud/Bienestar'
import { Molestias } from '../../components/salud/Molestias'
import { ZonasPulso } from '../../components/salud/Pulso'
import { FichaMedica } from '../../components/salud/FichaMedica'

type Tab = 'bienestar' | 'molestias' | 'pulso' | 'ficha'

/** Mi salud: bienestar, molestias, zonas de pulso y ficha médica. */
export default function Salud() {
  const { alumno, recargar } = useMiAlumno()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'bienestar'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })

  return (
    <Pantalla titulo="Mi salud" volver="/perfil">
      <Pestanas
        valor={tab}
        onChange={setTab}
        opciones={[
          { valor: 'bienestar', texto: '☀️ Día' },
          { valor: 'molestias', texto: '🩹 Dolor' },
          { valor: 'pulso', texto: '❤️ Pulso' },
          { valor: 'ficha', texto: '🆘 Ficha' },
        ]}
      />
      {tab === 'bienestar' && <HistorialBienestar alumnoId={alumno.id} />}
      {tab === 'molestias' && <Molestias alumnoId={alumno.id} puedeCargar />}
      {tab === 'pulso' && <ZonasPulso alumno={alumno} modo="alumno" onCambio={recargar} />}
      {tab === 'ficha' && <FichaMedica alumnoId={alumno.id} />}
    </Pantalla>
  )
}
