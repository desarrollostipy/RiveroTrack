import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { DIAS, diaSemana, hoyPY, sumarDias } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import { colorPuntaje, PREGUNTAS_BIENESTAR, puntajeBienestar, type Bienestar } from '../../lib/salud'
import { Boton, Campo, MensajeError, Tarjeta, Titulo, Vacio } from '../ui'

type Respuestas = { sueno: number; energia: number; dolor: number; animo: number }

const COLOR = { ok: 'bg-ok', parcial: 'bg-parcial', mal: 'bg-mal' } as const
const TEXTO_COLOR = { ok: 'text-ok', parcial: 'text-[#9A6B00]', mal: 'text-mal' } as const

/** Resumen en emojis de un día (😴 ⚡ 😀 😊). */
export function EmojisBienestar({ b }: { b: Respuestas }) {
  return (
    <span aria-label="Resumen del bienestar">
      {PREGUNTAS_BIENESTAR.map((p) => (
        <span key={p.campo} title={`${p.titulo} ${p.textos[b[p.campo] - 1]}`}>
          {p.opciones[b[p.campo] - 1]}
        </span>
      ))}
    </span>
  )
}

/** "¿Cómo amaneciste?": 4 preguntas con emojis, una vez por día. */
export function BienestarHoy({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const [registro, setRegistro] = useState<Bienestar | null | undefined>(undefined)
  const [editando, setEditando] = useState(false)
  const [resp, setResp] = useState<Partial<Respuestas>>({})
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    supabase
      .from('bienestar_diario')
      .select('*')
      .eq('alumno_id', alumnoId)
      .eq('fecha', hoy)
      .maybeSingle()
      .then(({ data }) => setRegistro((data as Bienestar | null) ?? null))
  }, [alumnoId, hoy])

  if (registro === undefined) return null

  const completo = PREGUNTAS_BIENESTAR.every((p) => resp[p.campo])

  async function guardar() {
    if (!completo) return setError('Respondé las 4 preguntas.')
    setGuardando(true)
    const { data, error } = await supabase
      .from('bienestar_diario')
      .upsert({ alumno_id: alumnoId, fecha: hoy, ...resp, nota: nota.trim() || null }, { onConflict: 'alumno_id,fecha' })
      .select()
      .single()
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    setRegistro(data as Bienestar)
    setEditando(false)
    setError('')
  }

  if (registro && !editando) {
    const p = puntajeBienestar(registro)
    const c = colorPuntaje(p)
    return (
      <Tarjeta className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-texto-2">Tu bienestar de hoy</p>
          <p className="text-2xl">
            <EmojisBienestar b={registro} />
          </p>
        </div>
        <div className="text-right">
          <p className={`font-titulo text-2xl font-extrabold ${TEXTO_COLOR[c]}`}>{p}</p>
          <button
            type="button"
            className="text-sm font-semibold text-azul"
            onClick={() => {
              setResp({ sueno: registro.sueno, energia: registro.energia, dolor: registro.dolor, animo: registro.animo })
              setNota(registro.nota ?? '')
              setEditando(true)
            }}
          >
            Cambiar
          </button>
        </div>
        {registro.dolor >= 3 && (
          <Link to="/salud?tab=molestias" className="w-full rounded-xl bg-parcial/20 px-3 py-2 text-sm font-semibold">
            🩹 ¿Te duele algo? Marcá dónde, así tu entrenador lo tiene en cuenta →
          </Link>
        )}
      </Tarjeta>
    )
  }

  return (
    <Tarjeta>
      <Titulo>☀️ ¿Cómo amaneciste?</Titulo>
      <p className="-mt-1 mb-3 text-sm text-texto-2">10 segundos. Le sirve a tu entrenador para ajustar tu plan.</p>
      <div className="flex flex-col gap-3">
        {PREGUNTAS_BIENESTAR.map((p) => (
          <fieldset key={p.campo}>
            <legend className="mb-1 text-sm font-semibold">{p.titulo}</legend>
            <div className="grid grid-cols-5 gap-1.5">
              {p.opciones.map((emoji, i) => {
                const elegido = resp[p.campo] === i + 1
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={elegido}
                    aria-label={p.textos[i]}
                    onClick={() => setResp((r) => ({ ...r, [p.campo]: i + 1 }))}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-xl border-2 text-2xl transition ${
                      elegido ? 'scale-105 border-azul bg-azul/10' : 'border-borde bg-superficie opacity-80'
                    }`}
                  >
                    {emoji}
                    <span className="text-[0.6rem] font-semibold text-texto-2">{p.textos[i]}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
        <Campo id="bienestar-nota" label="¿Algo para contar? (opcional)" value={nota} maxLength={300} onChange={(e) => setNota(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar} disabled={guardando || !completo}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </Tarjeta>
  )
}

/** Últimos 14 días: barra por día con el puntaje (verde, amarillo o rojo). */
export function HistorialBienestar({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const [filas, setFilas] = useState<Bienestar[] | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('bienestar_diario').select('*').eq('alumno_id', alumnoId).gte('fecha', sumarDias(hoy, -13)).order('fecha')
    setFilas((data ?? []) as Bienestar[])
  }, [alumnoId, hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!filas) return null
  const dias = Array.from({ length: 14 }, (_, i) => sumarDias(hoy, i - 13))
  const porDia = new Map(filas.map((f) => [f.fecha, f]))
  const prom = filas.length ? Math.round(filas.reduce((t, f) => t + puntajeBienestar(f), 0) / filas.length) : null
  const conNota = [...filas].reverse().filter((f) => f.nota)

  return (
    <Tarjeta>
      <Titulo accion={prom !== null ? <span className={`font-titulo text-xl font-extrabold ${TEXTO_COLOR[colorPuntaje(prom)]}`}>{prom}</span> : undefined}>
        ☀️ Bienestar · 14 días
      </Titulo>
      {filas.length === 0 ? (
        <Vacio>Todavía no hay registros de bienestar.</Vacio>
      ) : (
        <>
          <div className="flex h-28 gap-1" role="img" aria-label={`Bienestar de los últimos 14 días, promedio ${prom}`}>
            {dias.map((d) => {
              const b = porDia.get(d)
              const p = b ? puntajeBienestar(b) : 0
              return (
                <div key={d} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md ${b ? COLOR[colorPuntaje(p)] : 'bg-borde'}`}
                      style={{ height: b ? `${Math.max(8, p)}%` : '4px' }}
                      title={b ? `${formatoFecha(d)}: ${p}` : `${formatoFecha(d)}: sin registro`}
                    />
                  </div>
                  <span className="text-[0.6rem] text-texto-2">{DIAS[diaSemana(d)][0]}</span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-texto-2">Puntaje de 0 a 100: sueño, energía, dolor y ánimo.</p>
          {conNota.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1.5">
              {conNota.slice(0, 4).map((f) => (
                <li key={f.id} className="rounded-xl bg-fondo px-3 py-2 text-sm">
                  <span className="text-texto-2">{formatoFecha(f.fecha)} · </span>
                  <EmojisBienestar b={f} /> {f.nota}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Tarjeta>
  )
}
