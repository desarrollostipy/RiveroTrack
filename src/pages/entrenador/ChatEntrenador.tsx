import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion, type Perfil } from '../../lib/sesion'
import { Pantalla } from '../../components/Pantalla'
import { Chat } from '../../components/Chat'
import { Avatar, Cargando, estadoVigente, GloboEstado } from '../../components/ui'

// Chat del entrenador con un alumno.
export default function ChatEntrenador() {
  const { alumnoId } = useParams()
  const { perfil } = useSesion()
  const [alumno, setAlumno] = useState<{ id: string; nombre: string; perfil: Perfil | null } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: a } = await supabase.from('alumnos').select('id, nombre, profile_id').eq('id', alumnoId!).maybeSingle()
      if (!a) return
      const { data: p } = a.profile_id ? await supabase.from('profiles').select('*').eq('id', a.profile_id).maybeSingle() : { data: null }
      setAlumno({ id: a.id, nombre: a.nombre, perfil: p as Perfil | null })
    })()
  }, [alumnoId])

  if (!alumno || !perfil) return <Cargando pantalla />
  const estado = alumno.perfil ? estadoVigente(alumno.perfil) : null

  return (
    <Pantalla
      volver="/mensajes"
      titulo={
        <Link to={`/alumnos/${alumno.id}`} className="flex items-center gap-3">
          <Avatar url={alumno.perfil?.avatar_url} nombre={alumno.nombre} tam={40} />
          <span className="truncate">{alumno.nombre}</span>
        </Link>
      }
      subtitulo={estado ? <GloboEstado estado={estado} className="mt-1" /> : 'Tocá el nombre para ver su ficha'}
    >
      {!alumno.perfil ? (
        <p className="rounded-2xl border border-dashed border-borde px-4 py-6 text-center text-texto-2">
          {alumno.nombre} todavía no tiene acceso a la app. Creáselo desde su ficha para poder chatear.
        </p>
      ) : (
        <Chat alumnoId={alumno.id} miId={perfil.id} otro={{ nombre: alumno.nombre, avatar_url: alumno.perfil.avatar_url }} />
      )}
    </Pantalla>
  )
}
