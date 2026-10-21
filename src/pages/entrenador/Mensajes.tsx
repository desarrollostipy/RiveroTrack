import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { useNoLeidos, type Mensaje } from '../../lib/chat'
import type { Perfil } from '../../lib/sesion'
import { formatoFecha } from '../../lib/formato'
import { Pantalla } from '../../components/Pantalla'
import { Avatar, Campo, Cargando, estadoVigente, Vacio } from '../../components/ui'

type Fila = { id: string; nombre: string; profile_id: string | null }

// Lista de chats con los alumnos: primero los que tienen mensajes recientes.
export default function Mensajes() {
  const { perfil } = useSesion()
  const { porAlumno } = useNoLeidos(perfil?.id)
  const [alumnos, setAlumnos] = useState<Fila[] | null>(null)
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({})
  const [ultimos, setUltimos] = useState<Record<string, Mensaje>>({})
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('alumnos').select('id, nombre, profile_id').eq('activo', true).order('nombre'),
      supabase.from('profiles').select('*').eq('rol', 'alumno'),
      supabase.from('mensajes').select('*').order('created_at', { ascending: false }).limit(1000),
    ]).then(([a, p, m]) => {
      setAlumnos((a.data ?? []) as Fila[])
      setPerfiles(Object.fromEntries(((p.data ?? []) as Perfil[]).map((x) => [x.id, x])))
      const u: Record<string, Mensaje> = {}
      for (const x of (m.data ?? []) as Mensaje[]) u[x.alumno_id] ??= x
      setUltimos(u)
    })
  }, [porAlumno])

  const filas = useMemo(() => {
    const lista = (alumnos ?? []).filter((a) => a.nombre.toLowerCase().includes(buscar.trim().toLowerCase()))
    return lista.sort((a, b) => (ultimos[b.id]?.created_at ?? '').localeCompare(ultimos[a.id]?.created_at ?? '') || a.nombre.localeCompare(b.nombre))
  }, [alumnos, ultimos, buscar])

  return (
    <Pantalla titulo="Chat" subtitulo="Mensajes con tus alumnos">
      <Campo id="buscar-chat" label="Buscar alumno" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {alumnos === null && <Cargando />}
      {alumnos?.length === 0 && <Vacio>Todavía no hay alumnos.</Vacio>}
      <ul className="flex flex-col gap-2">
        {filas.map((a) => {
          const p = a.profile_id ? perfiles[a.profile_id] : null
          const ult = ultimos[a.id]
          const noLeidos = porAlumno[a.id] ?? 0
          const estado = p ? estadoVigente(p) : null
          return (
            <li key={a.id}>
              <Link to={`/chat/${a.id}`} className="flex min-h-16 items-center gap-3 rounded-2xl border border-borde bg-superficie px-3 py-2 hover:border-azul">
                <Avatar url={p?.avatar_url} nombre={a.nombre} tam={48} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className={`truncate ${noLeidos ? 'font-bold' : 'font-semibold'}`}>{a.nombre}</span>
                    {ult && <span className="shrink-0 text-xs text-texto-2">{formatoFecha(ult.created_at)}</span>}
                  </span>
                  <span className={`block truncate text-sm ${noLeidos ? 'font-semibold text-tinta' : 'text-texto-2'}`}>
                    {ult ? `${ult.autor_id === perfil?.id ? 'Vos: ' : ''}${ult.texto}` : estado ? `${estado.emoji ?? ''} ${estado.texto ?? ''}` : !a.profile_id ? 'Todavía no tiene acceso a la app' : 'Sin mensajes'}
                  </span>
                </span>
                {noLeidos > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-mal px-1.5 text-xs font-bold text-white">{noLeidos}</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </Pantalla>
  )
}
