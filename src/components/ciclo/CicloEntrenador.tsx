import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { DIAS_CORTOS, diasDeSemana, hoyPY } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import { cargarCiclosCompartidos, COLICOS, FASES, faseCompartida, FLUJOS, SINTOMAS, sugerenciaEntrenador, useCicloAlumna, type CicloCompartido, type Estimacion, type SintomasDia } from '../../lib/ciclo'

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
  if (!activo) return <p className="rounded-2xl bg-ciclo-fondo/60 px-4 py-2 text-sm text-ciclo">🌸 No comparte su ciclo. Lo elige ella en la app, desde “Mi ciclo”.</p>
  if (!info || !e) return null
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

/**
 * Ciclos de la semana (para armar los planes): una fila por alumna que comparte,
 * con la fase estimada de cada día. Las que no comparten no aparecen.
 */
export function CiclosSemana({ lunes, alumnas }: { lunes: string; alumnas: { id: string; nombre: string; comparte_ciclo: boolean }[] }) {
  const [datos, setDatos] = useState<Map<string, CicloCompartido> | null>(null)
  const ids = alumnas.filter((a) => a.comparte_ciclo).map((a) => a.id)
  const clave = ids.join(',')
  useEffect(() => {
    cargarCiclosCompartidos(clave ? clave.split(',') : []).then(setDatos)
  }, [clave])
  if (!alumnas.length) return null
  const dias = diasDeSemana(lunes)
  const hoy = hoyPY()
  const con = alumnas.filter((a) => datos?.has(a.id))
  const sin = alumnas.length - con.length
  return (
    <details className="rounded-2xl border border-ciclo/25 bg-ciclo-fondo text-ciclo" open>
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 font-semibold">
        <span>🌸 Ciclos de la semana ({con.length})</span>
        <span className="text-xs font-normal">{sin ? `${sin} no comparte${sin === 1 ? '' : 'n'}` : ''}</span>
      </summary>
      <div className="px-3 pb-3">
        {datos === null && <p className="px-1 text-sm">Cargando…</p>}
        {datos && con.length === 0 && <p className="px-1 text-sm">Ninguna alumna comparte su ciclo todavía. Cada una lo activa en “Mi ciclo → Ajustes”.</p>}
        {con.length > 0 && (
          <table className="w-full table-fixed border-separate border-spacing-y-1 text-center text-xs">
            <thead>
              <tr>
                <th className="w-[34%] text-left font-semibold">Alumna</th>
                {dias.map((d, i) => (
                  <th key={d} className={`font-semibold ${d === hoy ? 'underline' : ''}`}>
                    {DIAS_CORTOS[i]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {con.map((a) => {
                const c = datos!.get(a.id)!
                return (
                  <tr key={a.id}>
                    <td className="truncate text-left">
                      <Link to={`/alumnos/${a.id}`} className="font-semibold text-tinta hover:underline">
                        {a.nombre.split(' ')[0]}
                      </Link>
                    </td>
                    {dias.map((d) => {
                      const e = faseCompartida(c.registros, c.info, d)
                      const color = e?.enPeriodo ? FASES.menstrual.color : e?.fase ? FASES[e.fase].color : null
                      return (
                        <td key={d} title={e ? `Día ${e.dia}${e.fase ? ` · ${e.fase}` : e.enPeriodo ? ' · período' : ''}` : ''}>
                          <span
                            className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg text-[0.7rem] font-bold"
                            style={color ? { background: e?.enPeriodo ? color : `${color}33`, color: e?.enPeriodo ? 'white' : color } : undefined}
                          >
                            {e ? e.dia : '·'}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {con.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem]">
            <span>
              <b style={{ color: FASES.menstrual.color }}>■</b> período
            </span>
            <span>
              <b style={{ color: FASES.folicular.color }}>■</b> folicular
            </span>
            <span>
              <b style={{ color: FASES.ovulatoria.color }}>■</b> ovulatoria
            </span>
            <span>
              <b style={{ color: FASES.lútea.color }}>■</b> lútea
            </span>
            <span>número = día del ciclo · estimado</span>
          </p>
        )}
      </div>
    </details>
  )
}