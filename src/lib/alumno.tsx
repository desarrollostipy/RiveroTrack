import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useSesion } from './sesion'
import type { Alumno } from './tipos'
import { formatoFecha } from './formato'
import { Boton, Cargando, Logo } from '../components/ui'

// La ficha del alumno que inició sesión.
const Contexto = createContext<{ alumno: Alumno; recargar: () => Promise<void> } | null>(null)

export function MiAlumnoProvider({ children }: { children: ReactNode }) {
  const { perfil } = useSesion()
  const [alumno, setAlumno] = useState<Alumno | null | undefined>(undefined)

  const recargar = useCallback(async () => {
    const { data } = await supabase.from('alumnos').select('*').eq('profile_id', perfil!.id).maybeSingle()
    setAlumno(data as Alumno | null)
  }, [perfil])

  useEffect(() => {
    recargar()
  }, [recargar])

  if (alumno === undefined) return <Cargando pantalla />
  if (alumno === null) return <SolicitudPendiente onRevisar={recargar} />
  return <Contexto.Provider value={{ alumno, recargar }}>{children}</Contexto.Provider>
}

// Se registró solo y todavía no lo aceptaron.
function SolicitudPendiente({ onRevisar }: { onRevisar: () => Promise<void> }) {
  const { perfil, salir } = useSesion()
  const [solicitud, setSolicitud] = useState<{ created_at: string } | null | undefined>(undefined)
  const [revisando, setRevisando] = useState(false)

  useEffect(() => {
    supabase
      .from('solicitudes_alta')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSolicitud(data))
  }, [])

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo className="h-24" />
      <h1 className="font-titulo text-2xl font-extrabold">Hola, {perfil?.nombre.split(' ')[0]}</h1>
      {solicitud === undefined ? (
        <Cargando />
      ) : solicitud ? (
        <>
          <p className="text-lg">Tu solicitud está <strong>pendiente de aprobación</strong>.</p>
          <p className="text-texto-2">
            La enviaste el {formatoFecha(solicitud.created_at)}. Cuando tu entrenador te dé de alta, vas a ver acá tu plan de cada semana.
          </p>
        </>
      ) : (
        <p className="text-texto-2">Tu usuario todavía no está vinculado a una ficha de alumno. Avisale a tu entrenador.</p>
      )}
      <Boton
        className="w-full"
        disabled={revisando}
        onClick={async () => {
          setRevisando(true)
          await onRevisar()
          setRevisando(false)
        }}
      >
        {revisando ? 'Revisando…' : 'Ya me aceptaron · Revisar'}
      </Boton>
      <Boton variante="borde" className="w-full" onClick={salir}>
        Salir
      </Boton>
    </main>
  )
}

export function useMiAlumno() {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useMiAlumno fuera de MiAlumnoProvider')
  return ctx
}
