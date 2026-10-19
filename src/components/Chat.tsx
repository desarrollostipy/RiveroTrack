import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { avisarLeidos, type Mensaje } from '../lib/chat'
import { notificar } from '../lib/push'
import { hoyPY, sumarDias } from '../lib/fechas'
import { formatoFecha } from '../lib/formato'
import { Avatar, Cargando, MensajeError } from './ui'

const EMOJIS_RAPIDOS = ['👍', '💪', '🔥', '👏', '🙌', '😅', '😴', '🤕', '🏃', '❤️', '🎉', '🙏']

const fechaPY = (iso: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Asuncion', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso))
const horaPY = (iso: string) =>
  new Intl.DateTimeFormat('es-PY', { timeZone: 'America/Asuncion', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

function etiquetaDia(fecha: string) {
  const hoy = hoyPY()
  if (fecha === hoy) return 'Hoy'
  if (fecha === sumarDias(hoy, -1)) return 'Ayer'
  return formatoFecha(fecha)
}

/**
 * Conversación entre un alumno y el entrenador.
 * `abajo` es el espacio que ocupa la barra de navegación (si hay).
 */
export function Chat({
  alumnoId,
  miId,
  otro,
  abajo = '0px',
}: {
  alumnoId: string
  miId: string
  otro: { nombre: string; avatar_url: string | null }
  abajo?: string
}) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const final = useRef<HTMLDivElement>(null)

  // Ojo: la consulta solo se envía si se espera (await); sin eso nunca se marcaba como leído.
  const marcarLeidos = useCallback(async () => {
    const { error } = await supabase.rpc('marcar_chat_leido', { p_alumno_id: alumnoId })
    if (!error) avisarLeidos()
  }, [alumnoId])

  // Si el chat está abierto y se vuelve a la app, lo que llegó mientras tanto ya se leyó.
  useEffect(() => {
    const alVolver = () => document.visibilityState === 'visible' && marcarLeidos()
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [marcarLeidos])

  useEffect(() => {
    let vigente = true
    supabase
      .from('mensajes')
      .select('*')
      .eq('alumno_id', alumnoId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (!vigente) return
        setMensajes(((data ?? []) as Mensaje[]).reverse())
        marcarLeidos()
      })

    // Mensajes nuevos y "leído" en tiempo real.
    const canal = supabase
      .channel(`chat-${alumnoId}-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes', filter: `alumno_id=eq.${alumnoId}` }, (p) => {
        const m = p.new as Mensaje
        setMensajes((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev))
        if (m.autor_id !== miId) marcarLeidos()
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'mensajes', filter: `alumno_id=eq.${alumnoId}` }, (p) => {
        const m = p.new as Mensaje
        setMensajes((prev) => prev?.map((x) => (x.id === m.id ? m : x)) ?? prev)
      })
      .subscribe()
    return () => {
      vigente = false
      supabase.removeChannel(canal)
    }
  }, [alumnoId, miId, marcarLeidos])

  useEffect(() => {
    final.current?.scrollIntoView({ block: 'end' })
  }, [mensajes?.length])

  async function enviar(e?: FormEvent) {
    e?.preventDefault()
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    setError('')
    const { data, error } = await supabase.from('mensajes').insert({ alumno_id: alumnoId, texto: t }).select('*').single()
    setEnviando(false)
    if (error) return setError('No se pudo enviar. Revisá tu conexión.')
    setTexto('')
    notificar({ tipo: 'mensaje', alumno_id: alumnoId, texto: t })
    setMensajes((prev) => (prev && !prev.some((x) => x.id === (data as Mensaje).id) ? [...prev, data as Mensaje] : prev))
  }

  if (mensajes === null) return <Cargando />

  const miUltimo = [...mensajes].reverse().find((m) => m.autor_id === miId)

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1.5 pb-4">
        {mensajes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-texto-2">
            <Avatar url={otro.avatar_url} nombre={otro.nombre} tam={64} />
            <p>
              Escribile a <strong className="text-tinta">{otro.nombre}</strong>. 👋
            </p>
          </div>
        )}
        {mensajes.map((m, i) => {
          const mio = m.autor_id === miId
          const dia = fechaPY(m.created_at)
          const nuevoDia = i === 0 || fechaPY(mensajes[i - 1].created_at) !== dia
          const soloEmoji = /^(\p{Extended_Pictographic}|\p{Emoji_Component}|\s)+$/u.test(m.texto) && m.texto.length <= 12
          return (
            <div key={m.id} className="flex flex-col">
              {nuevoDia && <p className="my-2 self-center rounded-full bg-borde/60 px-3 py-0.5 text-xs text-texto-2">{etiquetaDia(dia)}</p>}
              <div className={`flex items-end gap-2 ${mio ? 'flex-row-reverse' : ''}`}>
                {!mio && <Avatar url={otro.avatar_url} nombre={otro.nombre} tam={28} />}
                <div
                  className={`max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 ${
                    soloEmoji ? 'bg-transparent text-4xl' : mio ? 'rounded-br-md bg-azul text-white' : 'rounded-bl-md border border-borde bg-superficie'
                  }`}
                >
                  {m.texto}
                  <span className={`mt-0.5 block text-right text-[0.7rem] ${mio && !soloEmoji ? 'text-white/75' : 'text-texto-2'}`}>
                    {horaPY(m.created_at)}
                    {mio && m.id === miUltimo?.id ? (m.leido_at ? ' · ✓✓ Leído' : ' · ✓ Enviado') : ''}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={final} />
      </div>

      <form onSubmit={enviar} className="sticky -mx-4 border-t border-borde bg-fondo/95 px-4 pb-2 pt-2 backdrop-blur" style={{ bottom: abajo }}>
        <div className="mb-2 flex gap-1 overflow-x-auto" aria-label="Emojis rápidos">
          {EMOJIS_RAPIDOS.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Agregar ${e}`}
              onClick={() => setTexto((t) => t + e)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl hover:bg-superficie"
            >
              {e}
            </button>
          ))}
        </div>
        <MensajeError>{error}</MensajeError>
        <div className="flex items-end gap-2">
          <label htmlFor="chat-texto" className="sr-only">
            Mensaje
          </label>
          <textarea
            id="chat-texto"
            rows={1}
            maxLength={2000}
            placeholder="Escribí un mensaje…"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer: fine)').matches) {
                e.preventDefault()
                enviar()
              }
            }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-borde bg-superficie px-3 py-2.5 text-base"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando}
            aria-label="Enviar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-azul text-lg text-white disabled:opacity-40"
          >
            ➤
          </button>
        </div>
      </form>
    </div>
  )
}
