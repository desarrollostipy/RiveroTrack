import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Plantilla } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { ObjetivosSesion, useTipos } from '../../components/Semana'
import { Boton, Cargando, EtiquetaTipo, Vacio } from '../../components/ui'

export function usePlantillas() {
  const [plantillas, setPlantillas] = useState<Plantilla[] | null>(null)
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('plantillas_sesion').select('*').order('nombre')
    setPlantillas((data ?? []) as Plantilla[])
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { plantillas, recargar: cargar }
}

// Sesiones guardadas para reutilizar al armar planes.
// Se crean desde el editor de planes: "Guardar como plantilla".
export default function Plantillas() {
  const { plantillas, recargar } = usePlantillas()
  const { tipo } = useTipos()

  async function borrar(p: Plantilla) {
    if (!confirm(`¿Borrar la plantilla "${p.nombre}"?`)) return
    await supabase.from('plantillas_sesion').delete().eq('id', p.id)
    recargar()
  }

  return (
    <Pantalla titulo="Plantillas de sesión" subtitulo="Se crean desde el editor de planes" volver="/herramientas">
      {plantillas === null && <Cargando />}
      {plantillas?.length === 0 && (
        <Vacio>
          En el editor de planes, abrí un día, cargá la sesión y tocá <strong>🧩 Guardar como plantilla</strong>. Después la usás con un toque en cualquier
          alumno.
        </Vacio>
      )}
      <ul className="flex flex-col gap-2">
        {plantillas?.map((p) => {
          const t = tipo(p.tipo)
          return (
            <li key={p.id} className="rounded-2xl border border-borde bg-superficie p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <EtiquetaTipo nombre={t.nombre} color={t.color} />
                  <span className="font-semibold">{p.nombre}</span>
                </span>
                <Boton variante="texto" onClick={() => borrar(p)} aria-label={`Borrar ${p.nombre}`}>
                  ✕
                </Boton>
              </div>
              {p.resumen && <p className="mb-1 text-sm">{p.resumen}</p>}
              <ObjetivosSesion s={{ ...p, id: p.id, plan_id: '', fecha: '', turno: 1 }} />
            </li>
          )
        })}
      </ul>
    </Pantalla>
  )
}
