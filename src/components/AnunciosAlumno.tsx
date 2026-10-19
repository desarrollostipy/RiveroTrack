import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../lib/supabase'
import { hoyPY, sumarDias } from '../lib/fechas'
import { formatoFecha } from '../lib/formato'
import { pushConfigurado, pushSoportado, suscripcionActual } from '../lib/push'
import type { Anuncio } from '../lib/tipos'

/** Anuncios del entrenador (fijados y de los últimos 7 días). */
export function AnunciosAlumno() {
  const [lista, setLista] = useState<Anuncio[]>([])

  const cargar = useCallback(async () => {
    const desde = sumarDias(hoyPY(), -7)
    const { data } = await supabase.from('anuncios').select('*').or(`fijado.eq.true,created_at.gte.${desde}`).order('created_at', { ascending: false }).limit(5)
    setLista(((data ?? []) as Anuncio[]).sort((a, b) => Number(b.fijado) - Number(a.fijado)))
  }, [])

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel(`anuncios-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'anuncios' }, () => cargar())
      .subscribe()
    return () => {
      supabase.removeChannel(canal)
    }
  }, [cargar])

  if (!lista.length) return null
  return (
    <section aria-label="Anuncios" className="flex flex-col gap-2">
      {lista.map((a) => (
        <div key={a.id} className="rounded-2xl border border-azul/40 bg-azul/10 px-4 py-3">
          <p className="mb-0.5 text-xs font-semibold text-azul">
            📢 {a.fijado ? 'Anuncio fijado' : 'Anuncio'} · {formatoFecha(a.created_at)}
          </p>
          <p className="whitespace-pre-wrap">{a.texto}</p>
        </div>
      ))}
    </section>
  )
}

const CLAVE = 'rivero-aviso-push-cerrado'

/** Invita a activar las notificaciones (una vez; se puede cerrar). */
export function InvitarNotificaciones() {
  const [ver, setVer] = useState(false)

  useEffect(() => {
    let cerrado = false
    try {
      cerrado = localStorage.getItem(CLAVE) === '1'
    } catch {
      // sin almacenamiento
    }
    if (cerrado || !pushConfigurado() || !pushSoportado()) return
    suscripcionActual().then((s) => setVer(!s))
  }, [])

  if (!ver) return null
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-borde bg-superficie px-3 py-2">
      <Link to="/perfil" className="flex-1 py-1 text-sm">
        🔔 <strong>Activá las notificaciones</strong> para enterarte cuando tu entrenador publique tu plan o te escriba.
      </Link>
      <button
        type="button"
        aria-label="Cerrar"
        className="h-11 w-11 shrink-0 rounded-full text-texto-2 hover:bg-fondo"
        onClick={() => {
          try {
            localStorage.setItem(CLAVE, '1')
          } catch {
            // sin almacenamiento
          }
          setVer(false)
        }}
      >
        ✕
      </button>
    </div>
  )
}
