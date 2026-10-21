import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { COLORES_GRUPO, useGrupos } from '../../lib/grupos'
import type { Grupo } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Campo, MensajeError, Tarjeta, Titulo, Vacio } from '../../components/ui'

// Grupos de alumnos: para filtrar, mandar anuncios y copiar planes a varios.
export default function Grupos() {
  const { grupos, recargar } = useGrupos()
  const [cantidad, setCantidad] = useState<Record<string, number>>({})
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLORES_GRUPO[0])
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('alumnos')
      .select('grupo_id')
      .eq('activo', true)
      .then(({ data }) => {
        const c: Record<string, number> = {}
        for (const a of (data ?? []) as { grupo_id: string | null }[]) if (a.grupo_id) c[a.grupo_id] = (c[a.grupo_id] ?? 0) + 1
        setCantidad(c)
      })
  }, [grupos])

  async function crear() {
    setError('')
    if (!nombre.trim()) return setError('Escribí el nombre del grupo.')
    const { error } = await supabase.from('grupos').insert({ nombre: nombre.trim(), color })
    if (error) return setError(mensajeError(error))
    setNombre('')
    recargar()
  }

  async function renombrar(g: Grupo) {
    const nuevo = prompt('Nuevo nombre del grupo', g.nombre)?.trim()
    if (!nuevo || nuevo === g.nombre) return
    const { error } = await supabase.from('grupos').update({ nombre: nuevo }).eq('id', g.id)
    if (error) return setError(mensajeError(error))
    recargar()
  }

  async function borrar(g: Grupo) {
    if (!confirm(`¿Borrar el grupo "${g.nombre}"? Los alumnos quedan sin grupo (no se borran).`)) return
    await supabase.from('grupos').delete().eq('id', g.id)
    recargar()
  }

  return (
    <Pantalla titulo="Grupos" subtitulo="El grupo de cada alumno se elige en su ficha (Editar)" volver="/herramientas">
      <Tarjeta className="flex flex-col gap-3">
        <Titulo>Nuevo grupo</Titulo>
        <Campo id="grupo-nombre" label="Nombre" placeholder="Ej: Principiantes · Grupo 21K · Mañana" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Color</legend>
          <div className="flex flex-wrap gap-2">
            {COLORES_GRUPO.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
                className={`h-11 w-11 rounded-full border-4 ${color === c ? 'border-tinta' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </fieldset>
        <MensajeError>{error}</MensajeError>
        <Boton onClick={crear}>Crear grupo</Boton>
      </Tarjeta>

      {grupos.length === 0 && <Vacio>Todavía no hay grupos.</Vacio>}
      <ul className="flex flex-col gap-2">
        {grupos.map((g) => (
          <li key={g.id} className="flex items-center justify-between gap-2 rounded-2xl border border-borde bg-superficie p-3">
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ background: g.color }} aria-hidden="true" />
              <span className="font-semibold">{g.nombre}</span>
              <span className="text-sm text-texto-2">· {cantidad[g.id] ?? 0} alumnos</span>
            </span>
            <span className="flex gap-1">
              <Boton variante="texto" onClick={() => renombrar(g)}>
                Renombrar
              </Boton>
              <Boton variante="texto" onClick={() => borrar(g)} aria-label={`Borrar ${g.nombre}`}>
                ✕
              </Boton>
            </span>
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}

/** Etiqueta de color con el nombre del grupo. */
export function EtiquetaGrupo({ grupo }: { grupo: Grupo | null }) {
  if (!grupo) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-borde px-2 py-0.5 text-xs font-semibold">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: grupo.color }} aria-hidden="true" />
      {grupo.nombre}
    </span>
  )
}
