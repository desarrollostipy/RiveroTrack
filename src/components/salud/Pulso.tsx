import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { hoyPY } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, leerNumero } from '../../lib/formato'
import { pulsoMaximo, tiempoEnZonas, zonasPulso } from '../../lib/salud'
import type { Alumno, Split } from '../../lib/tipos'
import { Boton, Campo, MensajeError, Tarjeta, Titulo, Vacio } from '../ui'

type SesionPulso = {
  id: string
  fecha: string
  duracion_seg: number | null
  fc_prom: number | null
  splits: Split[]
  sesiones_planificadas: { resumen: string | null } | null
}

/**
 * Zonas de pulso personales y cuánto tiempo pasó en cada una en las últimas sesiones.
 * El alumno puede cargar su pulso máximo y de reposo; el entrenador también.
 */
export function ZonasPulso({ alumno, modo, onCambio }: { alumno: Alumno; modo: 'alumno' | 'entrenador'; onCambio?: () => void }) {
  const hoy = hoyPY()
  const [editando, setEditando] = useState(false)
  const [fcMax, setFcMax] = useState(alumno.fc_max ? String(alumno.fc_max) : '')
  const [fcReposo, setFcReposo] = useState(alumno.fc_reposo ? String(alumno.fc_reposo) : '')
  const [error, setError] = useState('')
  const [sesiones, setSesiones] = useState<SesionPulso[] | null>(null)

  useEffect(() => {
    supabase
      .from('sesiones_registradas')
      .select('id, fecha, duracion_seg, fc_prom, splits, sesiones_planificadas(resumen)')
      .eq('alumno_id', alumno.id)
      .not('fc_prom', 'is', null)
      .order('fecha', { ascending: false })
      .limit(6)
      .then(({ data }) => setSesiones((data ?? []) as unknown as SesionPulso[]))
  }, [alumno.id])

  const max = pulsoMaximo(alumno, hoy)
  const zonas = max ? zonasPulso(max.valor, alumno.fc_reposo) : null

  async function guardar() {
    const m = leerNumero(fcMax)
    const r = fcReposo.trim() ? leerNumero(fcReposo) : null
    if (!m || m < 100 || m > 230) return setError('El pulso máximo va entre 100 y 230.')
    if (r !== null && (!r || r < 30 || r > 120)) return setError('El pulso de reposo va entre 30 y 120.')
    const { error } =
      modo === 'alumno'
        ? await supabase.rpc('set_mi_pulso', { p_fc_max: Math.round(m), p_fc_reposo: r === null ? null : Math.round(r) })
        : await supabase.from('alumnos').update({ fc_max: Math.round(m), fc_reposo: r === null ? null : Math.round(r) }).eq('id', alumno.id)
    if (error) return setError(mensajeError(error))
    setError('')
    setEditando(false)
    onCambio?.()
  }

  return (
    <Tarjeta>
      <Titulo
        accion={
          <Boton variante="texto" onClick={() => setEditando(!editando)}>
            {editando ? 'Cerrar' : 'Editar'}
          </Boton>
        }
      >
        ❤️ Zonas de pulso
      </Titulo>

      {editando && (
        <div className="mb-3 flex flex-col gap-2 rounded-2xl bg-fondo p-3">
          <div className="grid grid-cols-2 gap-2">
            <Campo id="fc-max" label="Pulso máximo" inputMode="numeric" value={fcMax} onChange={(e) => setFcMax(e.target.value)} />
            <Campo id="fc-reposo" label="Reposo (opcional)" inputMode="numeric" value={fcReposo} onChange={(e) => setFcReposo(e.target.value)} />
          </div>
          <p className="text-xs text-texto-2">
            El máximo lo da una prueba de esfuerzo o tu reloj. El de reposo se mide al despertar, antes de levantarte. Con los dos, las zonas son más precisas.
          </p>
          <MensajeError>{error}</MensajeError>
          <Boton onClick={guardar}>Guardar</Boton>
        </div>
      )}

      {!zonas || !max ? (
        <Vacio>Cargá el pulso máximo (o la fecha de nacimiento en la ficha) para ver las zonas.</Vacio>
      ) : (
        <>
          <p className="mb-2 text-sm text-texto-2">
            Máximo <b className="text-tinta">{max.valor} ppm</b>
            {max.estimado ? ' (estimado por la edad)' : ''}
            {alumno.fc_reposo ? ` · reposo ${alumno.fc_reposo} ppm` : ''}
          </p>
          <ul className="flex flex-col gap-1.5">
            {[...zonas].reverse().map((z) => (
              <li key={z.numero} className="flex items-center gap-3 rounded-xl bg-fondo p-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-titulo font-extrabold text-white" style={{ background: z.color }}>
                  Z{z.numero}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{z.nombre}</span>
                  <span className="block text-xs text-texto-2">{z.desc}</span>
                </span>
                <span className="shrink-0 font-mono text-sm font-semibold">
                  {z.min}–{z.max}
                </span>
              </li>
            ))}
          </ul>

          <p className="mb-1.5 mt-4 text-sm font-semibold text-texto-2">Tiempo en cada zona · últimas sesiones</p>
          {!sesiones ? null : sesiones.length === 0 ? (
            <Vacio>Las sesiones con pulso van a aparecer acá.</Vacio>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {sesiones.map((s) => {
                const { seg, porKm } = tiempoEnZonas({ splits: s.splits ?? [], fc_prom: s.fc_prom, duracion_seg: s.duracion_seg }, zonas)
                const total = seg.reduce((t, x) => t + x, 0)
                return (
                  <li key={s.id}>
                    <p className="mb-1 flex justify-between text-sm">
                      <span className="truncate">
                        {formatoFecha(s.fecha)} · {s.sesiones_planificadas?.resumen ?? 'Sesión'}
                      </span>
                      <span className="shrink-0 text-xs text-texto-2">{porKm ? 'por km' : `prom. ${s.fc_prom} ppm`}</span>
                    </p>
                    <div className="flex h-4 overflow-hidden rounded-full bg-borde" role="img" aria-label={zonas.map((z, i) => `Z${z.numero}: ${formatoDuracion(seg[i])}`).join(', ')}>
                      {total > 0 &&
                        zonas.map((z, i) =>
                          seg[i] ? <div key={z.numero} style={{ width: `${(100 * seg[i]) / total}%`, background: z.color }} title={`Z${z.numero}: ${formatoDuracion(seg[i])}`} /> : null,
                        )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  )
}
