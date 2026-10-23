import { Link } from 'react-router'
import { useMiAlumno } from '../../lib/alumno'
import { hoyPY } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import { estimarCicloPersonal, FASES, useCiclo } from '../../lib/ciclo'

// Resumen del ciclo en "Hoy" (solo alumnas). Todo el detalle está en /ciclo.
export function MiCiclo() {
  const { alumno } = useMiAlumno()
  const { registros, perfil, sintomas } = useCiclo(alumno.id)
  const hoy = hoyPY()
  if (perfil === undefined) return null
  const e = estimarCicloPersonal(registros, hoy, perfil)
  const cargadoHoy = sintomas.some((s) => s.fecha === hoy)

  return (
    <Link to="/ciclo" className="block rounded-2xl border border-ciclo/20 bg-ciclo-fondo p-4 text-ciclo" aria-label="Mi ciclo">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-titulo text-lg font-extrabold">Mi ciclo</h2>
        <span aria-hidden="true">›</span>
      </div>
      {!perfil ? (
        <p className="mt-1 text-sm">🌸 Personalizá tu ciclo: predicción con tus datos, síntomas y consejos para entrenar.</p>
      ) : e ? (
        <>
          <p className="mt-1 text-xl font-semibold">
            Día {e.dia}
            {e.fase ? ` · ${FASES[e.fase].emoji} fase ${e.fase}` : e.enPeriodo ? ' · con período' : ''}
          </p>
          <p className="text-sm">
            {e.atrasado ? 'Se esperaba' : 'Próximo'} entre el {formatoFecha(e.ventana[0])} y el {formatoFecha(e.ventana[1])}
          </p>
          {!cargadoHoy && <p className="mt-1 text-sm font-semibold underline">¿Cómo te sentís hoy? Registrá tus síntomas</p>}
        </>
      ) : (
        <p className="mt-1 text-sm">Registrá el inicio de tu período para ver el día y la predicción.</p>
      )}
    </Link>
  )
}
