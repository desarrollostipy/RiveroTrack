import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { hoyPY, sumarDias } from '../../lib/fechas'
import type { Alumno, Competencia } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { DetalleCompetencia, RevisarCompetencia } from '../../components/Competencias'
import { Cargando, Opciones, Titulo, Vacio } from '../../components/ui'

type Vista = 'aprobar' | 'proximas' | 'resultados'

// Competencias de todos los alumnos: las propuestas para aprobar,
// las próximas y los resultados recientes.
export default function CompetenciasEntrenador() {
  const hoy = hoyPY()
  const [lista, setLista] = useState<Competencia[] | null>(null)
  const [nombres, setNombres] = useState<Record<string, string>>({})
  const [vista, setVista] = useState<Vista>('aprobar')

  const cargar = useCallback(async () => {
    const [c, a] = await Promise.all([
      supabase.from('competencias').select('*').gte('fecha', sumarDias(hoy, -120)).order('fecha'),
      supabase.from('alumnos').select('id, nombre'),
    ])
    setLista((c.data ?? []) as Competencia[])
    setNombres(Object.fromEntries(((a.data ?? []) as Alumno[]).map((x) => [x.id, x.nombre])))
  }, [hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  const aprobar = (lista ?? []).filter((c) => c.estado === 'propuesta' && c.fecha >= hoy)
  const proximas = (lista ?? []).filter((c) => c.estado === 'aprobada' && c.fecha >= hoy)
  const resultados = (lista ?? []).filter((c) => c.estado === 'aprobada' && c.fecha < hoy).reverse()

  // Si no hay nada para aprobar, abrir directamente las próximas.
  useEffect(() => {
    if (lista && aprobar.length === 0 && vista === 'aprobar') setVista('proximas')
  }, [lista])

  const nombreDe = (c: Competencia) => (
    <Link to={`/alumnos/${c.alumno_id}`} className="underline">
      {nombres[c.alumno_id] ?? 'Alumno'}
    </Link>
  )

  return (
    <Pantalla titulo="Competencias" subtitulo="De todos tus alumnos" volver="/alumnos">
      {lista === null ? (
        <Cargando />
      ) : (
        <>
          <Opciones
            label="Mostrar"
            valor={vista}
            onChange={setVista}
            opciones={[
              { valor: 'aprobar', texto: `Para aprobar (${aprobar.length})` },
              { valor: 'proximas', texto: `Próximas (${proximas.length})` },
              { valor: 'resultados', texto: `Resultados (${resultados.length})` },
            ]}
          />

          {vista === 'aprobar' && (
            <>
              <Titulo>Para aprobar</Titulo>
              {aprobar.length === 0 && <Vacio>No hay competencias esperando tu respuesta.</Vacio>}
              {aprobar.map((c) => (
                <DetalleCompetencia key={c.id} c={c}>
                  <p className="-mt-1 text-sm">Propuesta por {nombreDe(c)}</p>
                  <RevisarCompetencia c={c} onListo={cargar} />
                </DetalleCompetencia>
              ))}
            </>
          )}

          {vista === 'proximas' && (
            <>
              <Titulo>Próximas</Titulo>
              {proximas.length === 0 && <Vacio>No hay competencias aprobadas próximamente.</Vacio>}
              {proximas.map((c) => (
                <DetalleCompetencia key={c.id} c={c}>
                  <p className="-mt-1 text-sm">{nombreDe(c)}</p>
                  <HoraYPlan c={c} onCambio={cargar} />
                </DetalleCompetencia>
              ))}
            </>
          )}

          {vista === 'resultados' && (
            <>
              <Titulo>Resultados (últimos 4 meses)</Titulo>
              {resultados.length === 0 && <Vacio>Todavía no hay carreras corridas.</Vacio>}
              {resultados.map((c) => (
                <DetalleCompetencia key={c.id} c={c}>
                  <p className="-mt-1 text-sm">
                    {nombreDe(c)}
                    {!c.resultado_tiempo_seg && <span className="text-texto-2"> · sin resultado cargado (cargalo desde su ficha)</span>}
                  </p>
                </DetalleCompetencia>
              ))}
            </>
          )}
        </>
      )}
    </Pantalla>
  )
}

/** Hora de largada (para el modo carrera y el clima) y acceso al plan de carrera. */
function HoraYPlan({ c, onCambio }: { c: Competencia; onCambio: () => void }) {
  const [hora, setHora] = useState(c.hora_largada?.slice(0, 5) ?? '')
  async function guardar(v: string) {
    setHora(v)
    await supabase.from('competencias').update({ hora_largada: v || null }).eq('id', c.id)
    onCambio()
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col text-sm font-semibold">
        Largada
        <input type="time" value={hora} onChange={(e) => guardar(e.target.value)} className="min-h-11 rounded-xl border border-borde bg-superficie px-3 font-mono" />
      </label>
      <Link to={`/plan-carrera/${c.id}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-azul px-3 text-sm font-semibold text-azul">
        🧭 Armar plan de carrera
      </Link>
    </div>
  )
}
