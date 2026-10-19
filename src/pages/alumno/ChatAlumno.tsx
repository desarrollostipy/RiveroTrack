import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { useMiAlumno } from '../../lib/alumno'
import { Pantalla } from '../../components/Pantalla'
import { Chat } from '../../components/Chat'
import { Avatar, Cargando } from '../../components/ui'

// Chat del alumno con su entrenador.
export default function ChatAlumno() {
  const { perfil } = useSesion()
  const { alumno } = useMiAlumno()
  const [entrenador, setEntrenador] = useState<{ nombre: string; avatar_url: string | null } | null>(null)

  useEffect(() => {
    supabase
      .rpc('perfil_entrenador')
      .then(({ data }) => setEntrenador(((data ?? []) as { nombre: string; avatar_url: string | null }[])[0] ?? { nombre: 'Tu entrenador', avatar_url: null }))
  }, [])

  return (
    <Pantalla
      titulo={
        <span className="flex items-center gap-3">
          {entrenador && <Avatar url={entrenador.avatar_url} nombre={entrenador.nombre} tam={40} />}
          <span>{entrenador?.nombre ?? 'Chat'}</span>
        </span>
      }
      subtitulo="Tu entrenador"
    >
      {!entrenador || !perfil ? (
        <Cargando />
      ) : (
        <Chat alumnoId={alumno.id} miId={perfil.id} otro={entrenador} abajo="calc(4.5rem + env(safe-area-inset-bottom))" />
      )}
    </Pantalla>
  )
}
