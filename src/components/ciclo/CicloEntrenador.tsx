import { hoyPY } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import { COLICOS, FASES, FLUJOS, SINTOMAS, sugerenciaEntrenador, useCicloAlumna, type Estimacion, type SintomasDia } from '../../lib/ciclo'

/** Texto corto de los síntomas de un día: "💧💧 Medio · cólicos moderados · 🤕 Dolor de cabeza". */
export function textoSintomas(s: SintomasDia) {
  return [
    s.flujo ? `${FLUJOS.find((f) => f.valor === s.flujo)?.gotas} ${FLUJOS.find((f) => f.valor === s.flujo)?.texto}` : null,
    s.colicos ? `cólicos ${COLICOS[s.colicos].toLowerCase()}` : null,
    ...s.sintomas.map((x) => {
      const d = SINTOMAS.find((y) => y.valor === x)
      return d ? `${d.emoji} ${d.texto}` : x
    }),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Chip con el día y la fase (para la agenda y el editor del plan). */
export function ChipFase({ e, corto = false }: { e: Estimacion | null; corto?: boolean }) {
  if (!e) return null
  const fase = e.fase ? FASES[e.fase] : null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-ciclo-fondo px-2 py-0.5 text-xs font-semibold text-ciclo" title="Fase estimada del ciclo">
      {fase ? fase.emoji : '🩸'} {corto ? (e.fase ?? (e.enPeriodo ? 'período' : `día ${e.dia}`)) : `Día ${e.dia}${e.fase ? ` · ${e.fase}` : e.enPeriodo ? ' · período' : ''}`}
    </span>
  )
}

/** Banner en la ficha: fase de hoy, síntomas compartidos y una sugerencia. */
export function BannerCiclo({ alumnoId, activo }: { alumnoId: string; activo: boolean }) {
  const hoy = hoyPY()
  const { info, fase, sintomas } = useCicloAlumna(alumnoId, activo)
  const e = fase(hoy)
  if (!activo || !info || !e) return null
  const deHoy = sintomas.find((s) => s.fecha === hoy) ?? null
  const reciente = deHoy ?? sintomas[0] ?? null
  const sugerencia = sugerenciaEntrenador(e, deHoy)
  return (
    <div className="rounded-2xl bg-ciclo-fondo px-4 py-3 text-ciclo">
      <p className="font-semibold">
        Ciclo: día {e.dia}
        {e.fase ? ` · ${FASES[e.fase].emoji} fase ${e.fase}` : e.enPeriodo ? ' · con período' : ''}
      </p>
      <p className="text-sm">
        Estimado · {e.atrasado ? `se esperaba entre el ${formatoFecha(e.ventana[0])} y el ${formatoFecha(e.ventana[1])}` : `próximo entre el ${formatoFecha(e.ventana[0])} y el ${formatoFecha(e.ventana[1])}`}
        {info.hormonal ? ' · usa anticonceptivo hormonal (sin fases)' : ''}
      </p>
      {info.nivel === 'sintomas' && reciente && (
        <p className="mt-1 text-sm">
          {reciente.fecha === hoy ? 'Hoy: ' : `${formatoFecha(reciente.fecha)}: `}
          {textoSintomas(reciente) || 'sin síntomas'}
        </p>
      )}
      {sugerencia && <p className="mt-1 text-sm font-semibold">💡 {sugerencia}</p>}
      <p className="mt-1 text-xs opacity-75">Ella eligió compartir esto. Orientativo, no es un dato médico.</p>
    </div>
  )
}
