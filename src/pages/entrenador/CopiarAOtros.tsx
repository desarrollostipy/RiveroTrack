import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { useGrupos } from '../../lib/grupos'
import { notificar } from '../../lib/push'
import { rangoSemana } from '../../lib/fechas'
import type { Alumno } from '../../lib/tipos'
import { Boton, Hoja, MensajeError } from '../../components/ui'

type FilaSesion = Record<string, unknown> & { fecha: string; turno: number }

/**
 * Copia el plan de esta semana a otros alumnos (por ejemplo, a todo un grupo).
 * Si un alumno ya registró sesiones esa semana, no se le toca el plan.
 */
export function CopiarAOtros({
  abierta,
  onCerrar,
  alumnoOrigen,
  lunes,
  sesiones,
  nota,
  onListo,
}: {
  abierta: boolean
  onCerrar: () => void
  alumnoOrigen: string
  lunes: string
  sesiones: FilaSesion[]
  nota: string
  onListo: (mensaje: string) => void
}) {
  const { grupos } = useGrupos()
  const [alumnos, setAlumnos] = useState<Pick<Alumno, 'id' | 'nombre' | 'grupo_id'>[]>([])
  const [elegidos, setElegidos] = useState<Set<string>>(new Set())
  const [publicar, setPublicar] = useState(false)
  const [trabajando, setTrabajando] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierta) return
    supabase
      .from('alumnos')
      .select('id, nombre, grupo_id')
      .eq('activo', true)
      .neq('id', alumnoOrigen)
      .order('nombre')
      .then(({ data }) => setAlumnos((data ?? []) as Alumno[]))
  }, [abierta, alumnoOrigen])

  const alternar = (id: string) => setElegidos((s) => (s.has(id) ? (s.delete(id), new Set(s)) : new Set(s.add(id))))
  const elegirGrupo = (grupoId: string) => setElegidos(new Set(alumnos.filter((a) => a.grupo_id === grupoId).map((a) => a.id)))

  async function copiar() {
    setError('')
    if (!elegidos.size) return setError('Elegí al menos un alumno.')
    const copiados: string[] = []
    const omitidos: string[] = []
    try {
      for (const a of alumnos.filter((x) => elegidos.has(x.id))) {
        setTrabajando(`Copiando a ${a.nombre}…`)
        const { data: plan, error: e1 } = await supabase
          .from('planes_semanales')
          .upsert({ alumno_id: a.id, semana_inicio: lunes }, { onConflict: 'alumno_id,semana_inicio' })
          .select('id')
          .single()
        if (e1) throw e1
        const planId = (plan as { id: string }).id
        const { data: existentes } = await supabase.from('sesiones_planificadas').select('id, sesiones_registradas(id)').eq('plan_id', planId)
        const conRegistro = ((existentes ?? []) as { sesiones_registradas: unknown }[]).some((s) =>
          Array.isArray(s.sesiones_registradas) ? s.sesiones_registradas.length > 0 : Boolean(s.sesiones_registradas),
        )
        if (conRegistro) {
          omitidos.push(a.nombre)
          continue
        }
        await supabase.from('sesiones_planificadas').delete().eq('plan_id', planId)
        if (sesiones.length) {
          const filas = sesiones.map(({ id: _id, plan_id: _p, ...resto }) => ({ ...resto, plan_id: planId }))
          const { error: e2 } = await supabase.from('sesiones_planificadas').insert(filas)
          if (e2) throw e2
        }
        await supabase
          .from('planes_semanales')
          .update({ nota_semana: nota.trim() || null, ...(publicar ? { estado: 'publicado', publicado_at: new Date().toISOString() } : {}) })
          .eq('id', planId)
        copiados.push(a.id)
      }
      if (publicar && copiados.length) notificar({ tipo: 'plan_publicado', alumno_ids: copiados, semana: lunes })
      setTrabajando('')
      setElegidos(new Set())
      onCerrar()
      onListo(
        `Plan copiado a ${copiados.length} alumno${copiados.length === 1 ? '' : 's'}${publicar ? ' y publicado' : ' (en borrador)'}.` +
          (omitidos.length ? ` No se tocó a ${omitidos.join(', ')}: ya registraron sesiones esta semana.` : ''),
      )
    } catch (e) {
      setTrabajando('')
      setError(mensajeError(e))
    }
  }

  return (
    <Hoja titulo="Copiar este plan a otros" abierta={abierta} onCerrar={onCerrar}>
      <p className="text-sm text-texto-2">
        Semana {rangoSemana(lunes)}. Se reemplaza el plan de esa semana de cada alumno elegido; después podés ajustar a cada uno.
      </p>
      {grupos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {grupos.map((g) => (
            <Boton key={g.id} variante="borde" onClick={() => elegirGrupo(g.id)}>
              <span className="mr-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: g.color }} />
              Todo {g.nombre}
            </Boton>
          ))}
        </div>
      )}
      <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
        {alumnos.map((a) => (
          <li key={a.id}>
            <label className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-superficie">
              <input type="checkbox" className="h-5 w-5" checked={elegidos.has(a.id)} onChange={() => alternar(a.id)} />
              <span>{a.nombre}</span>
            </label>
          </li>
        ))}
      </ul>
      <label className="flex min-h-11 items-center gap-3">
        <input type="checkbox" className="h-5 w-5" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
        <span>Publicar directamente (les llega el aviso)</span>
      </label>
      {trabajando && <p role="status" className="font-semibold text-azul">{trabajando}</p>}
      <MensajeError>{error}</MensajeError>
      <Boton onClick={copiar} disabled={!!trabajando}>
        Copiar a {elegidos.size} alumno{elegidos.size === 1 ? '' : 's'}
      </Boton>
    </Hoja>
  )
}
