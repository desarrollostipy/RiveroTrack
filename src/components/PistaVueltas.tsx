import { useEffect, useState } from 'react'
import { leerDuracion } from '../lib/formato'
import { textoDistanciaRep, textoTiempo } from '../lib/intervalos'
import { DISTANCIAS_PISTA, resumenBloque, resumenPista, textoBloque, totalRep, tramos, type BloquePista } from '../lib/pista'
import { Anillo, Boton, lanzarConfeti } from './ui'

type RepUI = { vueltas: string[]; rec: string }
type BloqueUI = { clave: number; distancia_m: number; reps: RepUI[] }

// "128" → "1:28" mientras se tipea (y "16" son 16 segundos).
export function formatearTiempoTipeo(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`
}

/** "1:28" → 88; "16" → 16 segundos (en pista, un número solo son segundos). */
export const leerTiempoVuelta = (t: string) => (!t.trim() ? null : t.includes(':') ? leerDuracion(t) : Number(t) || null)

const aTexto = (s: number | null | undefined) => (s ? (s >= 60 ? textoTiempo(s) : String(s)) : '')
let siguiente = 1

const repVacia = (distancia_m: number): RepUI => ({ vueltas: tramos(distancia_m).map(() => ''), rec: '' })

function aBloques(ui: BloqueUI[]): BloquePista[] {
  return ui.map((b) => ({
    distancia_m: b.distancia_m,
    reps: b.reps.map((r) => ({ vueltas: r.vueltas.map((v) => leerTiempoVuelta(v) ?? 0), rec_seg: leerTiempoVuelta(r.rec) })),
  }))
}

/**
 * Armar la sesión de pista al registrarla: bloques (6×800, 4×400…), el tiempo de cada
 * vuelta de 400 m y la recuperación de cada repetición. Avisa los bloques ya convertidos.
 */
export function EditorPista({ inicial, onChange }: { inicial: BloquePista[]; onChange: (b: BloquePista[]) => void }) {
  const [bloques, setBloques] = useState<BloqueUI[]>(() =>
    inicial.map((b) => ({
      clave: siguiente++,
      distancia_m: b.distancia_m,
      reps: b.reps.map((r) => ({ vueltas: tramos(b.distancia_m).map((_, i) => aTexto(r.vueltas[i])), rec: aTexto(r.rec_seg) })),
    })),
  )
  const [cantidad, setCantidad] = useState('6')
  const [distancia, setDistancia] = useState<number | null>(800)
  const [otra, setOtra] = useState('')

  useEffect(() => {
    onChange(aBloques(bloques))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bloques])

  const cambiar = (clave: number, f: (b: BloqueUI) => BloqueUI) => setBloques((l) => l.map((b) => (b.clave === clave ? f(b) : b)))

  function agregar() {
    const m = otra ? Math.round(Number(otra.replace(/\D/g, ''))) : distancia
    const n = Math.round(Number(cantidad) || 0)
    if (!m || m < 50 || m > 20000 || n < 1 || n > 40) return
    setBloques((l) => [...l, { clave: siguiente++, distancia_m: m, reps: Array.from({ length: n }, () => repVacia(m)) }])
    setOtra('')
  }

  const total = resumenPista(aBloques(bloques))
  const [enVivo, setEnVivo] = useState(false)

  return (
    <div className="flex flex-col gap-3">
      {bloques.length > 0 && (
        <button
          type="button"
          onClick={() => setEnVivo(true)}
          className="boton-accion flex min-h-14 items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          🏟️ Modo pista: cargar vuelta por vuelta en pantalla grande
        </button>
      )}
      {enVivo && (
        <ModoPista
          bloques={bloques}
          onVuelta={(clave, i, k, texto) =>
            cambiar(clave, (x) => ({ ...x, reps: x.reps.map((y, j) => (j === i ? { ...y, vueltas: y.vueltas.map((v, q) => (q === k ? texto : v)) } : y)) }))
          }
          onRec={(clave, i, texto) => cambiar(clave, (x) => ({ ...x, reps: x.reps.map((y, j) => (j === i ? { ...y, rec: texto } : y)) }))}
          onCerrar={() => setEnVivo(false)}
        />
      )}
      {bloques.map((b) => {
        const t = tramos(b.distancia_m)
        const res = resumenBloque(aBloques([b])[0])
        return (
          <div key={b.clave} className="rounded-xl border border-borde bg-superficie p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-titulo text-lg font-extrabold">
                {b.reps.length} × {textoDistanciaRep(b.distancia_m)}
              </p>
              <div className="flex gap-1">
                <Boton variante="borde" className="!min-h-9 !px-3" aria-label="Una repetición menos" onClick={() => cambiar(b.clave, (x) => ({ ...x, reps: x.reps.slice(0, Math.max(1, x.reps.length - 1)) }))}>
                  −
                </Boton>
                <Boton variante="borde" className="!min-h-9 !px-3" aria-label="Una repetición más" onClick={() => cambiar(b.clave, (x) => ({ ...x, reps: [...x.reps, repVacia(x.distancia_m)] }))}>
                  +
                </Boton>
                <Boton variante="texto" className="!min-h-9 !px-2 text-mal" onClick={() => confirm('¿Quitar este bloque?') && setBloques((l) => l.filter((x) => x.clave !== b.clave))}>
                  Quitar
                </Boton>
              </div>
            </div>
            {t.length > 1 && <p className="text-xs text-texto-2">Cargá cada vuelta: {t.map((m) => `${m} m`).join(' + ')}</p>}

            <ol className="mt-2 flex flex-col gap-2">
              {b.reps.map((r, i) => {
                const tot = totalRep(aBloques([{ ...b, reps: [r] }])[0].reps[0], b.distancia_m)
                return (
                  <li key={i} className="flex flex-wrap items-end gap-1.5 border-t border-borde pt-2 first:border-0 first:pt-0">
                    <span className="w-4 self-center text-sm font-bold text-texto-2">{i + 1}</span>
                    {t.map((m, k) => (
                      <label key={k} className="flex w-[3.6rem] flex-col text-[0.65rem] text-texto-2">
                        {t.length > 1 ? `V${k + 1} · ${m}` : `${m} m`}
                        <input
                          inputMode="numeric"
                          aria-label={`Repetición ${i + 1}, ${t.length > 1 ? `vuelta ${k + 1}` : 'tiempo'}`}
                          className="min-h-10 rounded-lg border border-borde bg-superficie px-1 text-center font-mono text-base text-tinta"
                          placeholder={m === 400 ? '1:28' : m <= 200 ? '32' : ''}
                          value={r.vueltas[k] ?? ''}
                          onChange={(e) =>
                            cambiar(b.clave, (x) => ({
                              ...x,
                              reps: x.reps.map((y, j) => (j === i ? { ...y, vueltas: y.vueltas.map((v, q) => (q === k ? formatearTiempoTipeo(e.target.value) : v)) } : y)),
                            }))
                          }
                        />
                      </label>
                    ))}
                    {t.length > 1 && (
                      <span className="flex min-h-10 min-w-11 flex-col justify-end text-[0.65rem] text-texto-2">
                        Total
                        <b className="font-mono text-base text-tinta">{tot ? textoTiempo(tot) : '—'}</b>
                      </span>
                    )}
                    {i < b.reps.length - 1 && (
                      <label className="ml-auto flex w-[3.6rem] flex-col text-[0.65rem] text-[#0F6E78]">
                        Recup.
                        <input
                          inputMode="numeric"
                          aria-label={`Recuperación después de la repetición ${i + 1}`}
                          className="min-h-10 rounded-lg border border-[#0F6E78]/40 bg-[#0F6E78]/5 px-1 text-center font-mono text-base text-tinta"
                          placeholder="1:30"
                          value={r.rec}
                          onChange={(e) => cambiar(b.clave, (x) => ({ ...x, reps: x.reps.map((y, j) => (j === i ? { ...y, rec: formatearTiempoTipeo(e.target.value) } : y)) }))}
                        />
                      </label>
                    )}
                  </li>
                )
              })}
            </ol>
            {b.reps.length > 1 && (
              <button
                type="button"
                className="mt-2 text-xs font-semibold text-[#0F6E78] underline"
                onClick={() =>
                  cambiar(b.clave, (x) => {
                    const primera = x.reps.find((y) => y.rec)?.rec ?? ''
                    return { ...x, reps: x.reps.map((y, j) => (j < x.reps.length - 1 ? { ...y, rec: primera } : y)) }
                  })
                }
              >
                Copiar la primera recuperación a todas
              </button>
            )}
            {res && <p className="mt-2 rounded-lg bg-azul/10 px-3 py-2 text-sm font-semibold text-azul">📊 {textoBloque(aBloques([b])[0])}</p>}
          </div>
        )
      })}

      <div className="rounded-xl border border-dashed border-azul/50 p-3">
        <p className="mb-2 text-sm font-semibold">+ Agregar bloque</p>
        <div className="flex items-end gap-2">
          <label className="flex w-16 flex-col text-xs font-medium">
            Cantidad
            <input
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-borde bg-superficie px-2 text-center text-base"
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value.replace(/\D/g, '').slice(0, 2))}
            />
          </label>
          <span className="pb-3 font-bold">×</span>
          <label className="flex min-w-0 flex-1 flex-col text-xs font-medium">
            Otra distancia (m)
            <input
              inputMode="numeric"
              className="min-h-11 w-full min-w-0 rounded-xl border border-borde bg-superficie px-2 text-base"
              placeholder={distancia ? `${distancia}` : 'ej. 700'}
              value={otra}
              onChange={(e) => setOtra(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </label>
          <Boton onClick={agregar}>Agregar</Boton>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {DISTANCIAS_PISTA.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={!otra && distancia === m}
              onClick={() => (setDistancia(m), setOtra(''))}
              className={`min-h-9 rounded-full border px-3 text-sm font-semibold ${!otra && distancia === m ? 'border-transparent bg-azul text-white' : 'border-borde bg-superficie'}`}
            >
              {textoDistanciaRep(m)}
            </button>
          ))}
        </div>
      </div>

      {total.km > 0 && (
        <p className="rounded-xl bg-ok/10 px-3 py-2 text-sm">
          <b>Total:</b> {total.texto} · <b className="font-mono">{total.km.toLocaleString('es-PY')} km</b> en <b className="font-mono">{textoTiempo(total.segundos)}</b>
          {total.ritmo ? ` · ${textoTiempo(total.ritmo)}/km` : ''} <span className="text-texto-2">(sin recuperación)</span>
        </p>
      )}
    </div>
  )
}

type Cursor = { b: number; i: number; k: number }

/**
 * Modo pista en vivo: pantalla completa con números gigantes y un teclado propio.
 * Se carga cada vuelta al terminarla; entre repeticiones corre un cronómetro de recuperación
 * que vibra al llegar a la meta. Mantiene la pantalla encendida mientras está abierto.
 */
function ModoPista({
  bloques,
  onVuelta,
  onRec,
  onCerrar,
}: {
  bloques: BloqueUI[]
  onVuelta: (clave: number, i: number, k: number, texto: string) => void
  onRec: (clave: number, i: number, texto: string) => void
  onCerrar: () => void
}) {
  // Arranca en la primera vuelta sin tiempo.
  const primeraVacia = (): Cursor | null => {
    for (let b = 0; b < bloques.length; b++)
      for (let i = 0; i < bloques[b].reps.length; i++) {
        const k = bloques[b].reps[i].vueltas.findIndex((v) => !v)
        if (k >= 0) return { b, i, k }
      }
    return null
  }
  const [cursor, setCursor] = useState<Cursor | null>(primeraVacia)
  const [digitos, setDigitos] = useState('')
  const [recDesde, setRecDesde] = useState<number | null>(null) // momento en que empezó la recuperación
  const [meta, setMeta] = useState(() => leerTiempoVuelta(bloques[0]?.reps.find((r) => r.rec)?.rec ?? '') || 90)
  const [ahora, setAhora] = useState(() => Date.now())
  const [avisado, setAvisado] = useState(false)

  // Pantalla siempre encendida mientras se usa (si el celular lo permite).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    document.body.style.overflow = 'hidden'
    return () => {
      lock?.release().catch(() => {})
      document.body.style.overflow = ''
    }
  }, [])

  // Cronómetro de recuperación.
  useEffect(() => {
    if (recDesde === null) return
    const id = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(id)
  }, [recDesde])
  const recSeg = recDesde === null ? 0 : Math.floor((ahora - recDesde) / 1000)
  useEffect(() => {
    if (recDesde !== null && !avisado && recSeg >= meta) {
      setAvisado(true)
      navigator.vibrate?.([250, 120, 250, 120, 400])
    }
  }, [recSeg, meta, recDesde, avisado])

  const bloque = cursor ? bloques[cursor.b] : null
  const t = bloque ? tramos(bloque.distancia_m) : []

  function avanzar(c: Cursor) {
    const b = bloques[c.b]
    if (c.k + 1 < tramos(b.distancia_m).length) return setCursor({ ...c, k: c.k + 1 })
    // Terminó la repetición: si quedan otras, recuperación.
    if (c.i + 1 < b.reps.length) {
      setRecDesde(Date.now())
      setAhora(Date.now())
      setAvisado(false)
      return setCursor({ b: c.b, i: c.i + 1, k: 0 })
    }
    if (c.b + 1 < bloques.length) return setCursor({ b: c.b + 1, i: 0, k: 0 })
    setCursor(null)
    lanzarConfeti()
  }

  function guardarVuelta() {
    if (!cursor || !bloque || !digitos) return
    onVuelta(bloque.clave, cursor.i, cursor.k, formatearTiempoTipeo(digitos))
    navigator.vibrate?.(20)
    setDigitos('')
    avanzar(cursor)
  }

  function arrancarSiguiente() {
    if (!cursor || !bloque || recDesde === null) return
    // La recuperación se guarda en la repetición anterior.
    onRec(bloque.clave, cursor.i - 1, aTexto(recSeg))
    setRecDesde(null)
  }

  const tecla = 'flex h-16 items-center justify-center rounded-2xl bg-white/8 font-titulo text-3xl font-black active:bg-white/20'
  const enRecuperacion = recDesde !== null && cursor !== null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#060A17] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)] text-white" role="dialog" aria-modal="true" aria-label="Modo pista">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-widest text-white/60">🏟️ Modo pista</p>
        <button type="button" onClick={onCerrar} className="min-h-11 rounded-full bg-white/10 px-4 font-semibold">
          Listo ✕
        </button>
      </div>

      {!cursor && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="text-6xl" aria-hidden="true">
            🎉
          </p>
          <p className="font-titulo text-4xl font-black">¡Pista terminada!</p>
          {bloques.map((b) => (
            <p key={b.clave} className="rounded-2xl bg-white/8 px-3 py-2 text-sm font-semibold text-[#C8FF3D]">
              📊 {textoBloque(aBloques([b])[0])}
            </p>
          ))}
          <button type="button" onClick={onCerrar} className="boton-accion mt-4 min-h-14 w-full rounded-2xl text-lg font-bold">
            Volver al registro
          </button>
        </div>
      )}

      {cursor && bloque && (
        <>
          <div className="mt-4 text-center">
            <p className="font-titulo text-2xl font-black">
              {bloque.reps.length} × {textoDistanciaRep(bloque.distancia_m)}
            </p>
            <p className="text-lg text-white/75">
              Repetición <b className="text-white">{cursor.i + 1}</b> de {bloque.reps.length}
              {t.length > 1 && (
                <>
                  {' · '}vuelta <b className="text-white">{cursor.k + 1}</b> de {t.length} ({t[cursor.k]} m)
                </>
              )}
            </p>
          </div>

          {enRecuperacion ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              <p className="text-sm font-bold uppercase tracking-widest text-[#5EEAD4]">Recuperación</p>
              <Anillo pct={recSeg / meta} tam={230} grosor={14} color={recSeg >= meta ? '#C8FF3D' : '#5EEAD4'} fondo="rgba(255,255,255,0.1)">
                <span className="font-titulo text-6xl font-black tabular-nums">{textoTiempo(recSeg) || '0'}</span>
                <span className="mt-1 text-sm text-white/70">meta {textoTiempo(meta)}</span>
              </Anillo>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setMeta(Math.max(15, meta - 15))} className="h-11 rounded-full bg-white/10 px-4 font-bold">
                  −15 s
                </button>
                <button type="button" onClick={() => setMeta(meta + 15)} className="h-11 rounded-full bg-white/10 px-4 font-bold">
                  +15 s
                </button>
              </div>
              <button type="button" onClick={arrancarSiguiente} className="boton-accion min-h-16 w-full rounded-2xl text-xl font-black">
                ▶ Arrancar repetición {cursor.i + 1}
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-1 flex-col items-center justify-center">
                <p className={`font-titulo text-[5.5rem] font-black leading-none tabular-nums ${digitos ? 'text-white' : 'text-white/25'}`}>
                  {digitos ? formatearTiempoTipeo(digitos) : t[cursor.k] === 400 ? '1:28' : '0:00'}
                </p>
                <p className="mt-2 text-sm text-white/60">Tiempo de esta vuelta</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button key={d} type="button" className={tecla} onClick={() => setDigitos((x) => (x + d).slice(0, 4))}>
                    {d}
                  </button>
                ))}
                <button type="button" className={`${tecla} text-xl`} aria-label="Borrar" onClick={() => setDigitos((x) => x.slice(0, -1))}>
                  ⌫
                </button>
                <button type="button" className={tecla} onClick={() => setDigitos((x) => (x + '0').slice(0, 4))}>
                  0
                </button>
                <button type="button" className={`${tecla} !bg-[#C8FF3D] text-[#0A1206] disabled:opacity-40`} disabled={!digitos} aria-label="Guardar vuelta" onClick={guardarVuelta}>
                  ✓
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

/** Vista de solo lectura (para el entrenador): cada bloque con sus repeticiones y su resumen. */
export function ResumenPista({ bloques }: { bloques: BloquePista[] }) {
  if (!bloques.length) return null
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-azul/5 p-3 text-sm">
      <p className="font-semibold">🏟️ Pista vuelta por vuelta</p>
      {bloques.map((b, i) => (
        <div key={i}>
          <p className="font-semibold text-azul">📊 {textoBloque(b)}</p>
          <ol className="mt-1 flex flex-wrap gap-1.5">
            {b.reps.map((r, j) => {
              const tot = totalRep(r, b.distancia_m)
              return (
                <li key={j} className="rounded-lg bg-superficie px-2 py-1 font-mono text-xs" title={tramos(b.distancia_m).length > 1 ? r.vueltas.map(aTexto).join(' + ') : undefined}>
                  {j + 1}) {tot ? textoTiempo(tot) : '—'}
                  {tramos(b.distancia_m).length > 1 && tot ? <span className="text-texto-2"> ({r.vueltas.map(aTexto).join('+')})</span> : null}
                  {r.rec_seg ? <span className="text-[#0F6E78]"> · rec {aTexto(r.rec_seg)}</span> : null}
                </li>
              )
            })}
          </ol>
        </div>
      ))}
    </div>
  )
}
