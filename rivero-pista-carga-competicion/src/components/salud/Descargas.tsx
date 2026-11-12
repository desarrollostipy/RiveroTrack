import { useState } from 'react'
import { Link } from 'react-router'
import { hoyPY } from '../../lib/fechas'
import { formatoFecha, formatoKm } from '../../lib/formato'
import { mensajeError } from '../../lib/consultas'
import {
  cambiarUmbral,
  estadoCarga,
  recomendarDescarga,
  registrarDescarga,
  TIPOS_DESCARGA,
  UMBRAL_BASE,
  UMBRALES,
  useCarga,
  type TipoDescarga,
} from '../../lib/descargas'
import { supabase } from '../../lib/supabase'
import { AreaTexto, Anillo, Boton, Campo, Hoja, MensajeError, Opciones, Tarjeta, Titulo } from '../ui'

const TEXTO_TIPO: Record<TipoDescarga, string> = { fisio: '🩺 Fisio', masaje: '💆 Masaje', otra: '✨ Otra' }

/**
 * Carga acumulada: km desde la última descarga muscular contra el límite del alumno.
 * El alumno registra sus descargas; el entrenador además cambia el límite y la recomienda.
 */
export function CargaAcumulada({ alumnoId, nombre, modo, onCambio }: { alumnoId: string; nombre: string; modo: 'alumno' | 'entrenador'; onCambio?: () => void }) {
  const { carga, historial, listo, recargar } = useCarga(alumnoId)
  const [registrar, setRegistrar] = useState(false)
  const [umbralAbierto, setUmbralAbierto] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  if (!listo) return null
  if (!carga)
    return (
      <Tarjeta>
        <Titulo>💆 Carga acumulada</Titulo>
        <p className="text-sm text-texto-2">Falta activar esta función en la base de datos (SQL de carga acumulada).</p>
      </Tarjeta>
    )

  const e = estadoCarga(carga)
  const recomendada = !!carga.recomendada_el
  const esEntrenador = modo === 'entrenador'

  async function recomendar() {
    if (!carga) return
    setError('')
    setOk('')
    setEnviando(true)
    const err = await recomendarDescarga(alumnoId, nombre, carga)
    setEnviando(false)
    if (err) return setError(mensajeError(err))
    setOk('Listo: le llegó un mensaje al chat con la recomendación.')
    recargar()
  }

  async function borrar(id: string) {
    if (!confirm('¿Borrar esta descarga?')) return
    const { error } = await supabase.from('descargas').delete().eq('id', id)
    if (error) return setError(mensajeError(error))
    recargar()
  }

  return (
    <Tarjeta>
      <Titulo>💆 Carga acumulada</Titulo>
      <div className="flex items-center gap-4">
        <Anillo pct={e.nivel === 'sin_dato' ? 0 : Math.min(1, e.pct)} tam={96} grosor={10} color={e.color} fondo="var(--color-borde)">
          <span className="flex flex-col items-center leading-none">
            <b className="font-mono text-xl">{formatoKm(carga.km)}</b>
            <span className="text-[0.65rem] text-texto-2">km</span>
          </span>
        </Anillo>
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ color: e.color, background: `color-mix(in oklab, ${e.color} 15%, transparent)` }}>
            {e.texto}
          </span>
          <p className="mt-1 text-sm">
            {carga.ultima_descarga ? (
              <>
                Desde {esEntrenador ? 'la' : 'tu'} última descarga, el <b>{formatoFecha(carga.ultima_descarga)}</b>.
              </>
            ) : (
              <>
                En las últimas 4 semanas. <b>Todavía no hay descargas registradas:</b> {esEntrenador ? 'registrá la última' : 'registrá cuándo fue tu última'} para empezar a contar.
              </>
            )}
          </p>
          <p className="text-xs text-texto-2">
            Límite: {carga.umbral_km} km
            {e.nivel === 'sin_dato' ? '' : e.nivel === 'toca' ? ` · te pasaste por ${formatoKm(carga.km - carga.umbral_km)} km` : ` · faltan ${formatoKm(e.faltan)} km`}
          </p>
        </div>
      </div>

      {recomendada && (
        <p className="mt-3 rounded-xl bg-[#FF6B6B]/10 px-3 py-2 text-sm font-semibold text-[#FF6B6B]">
          💆 {esEntrenador ? 'Ya le recomendaste' : 'Tu entrenador te recomendó'} una descarga el {formatoFecha(carga.recomendada_el!)}.
        </p>
      )}
      {!recomendada && e.nivel === 'toca' && !esEntrenador && (
        <p className="mt-3 rounded-xl bg-[#FF6B6B]/10 px-3 py-2 text-sm font-semibold text-[#FF6B6B]">Pasaste tu límite: es buen momento para una descarga con la fisio. Consultalo con tu entrenador.</p>
      )}

      <MensajeError>{error}</MensajeError>
      {ok && <p className="mt-2 text-sm font-semibold text-ok">{ok}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {esEntrenador && (
          <Boton variante={e.nivel === 'cerca' || e.nivel === 'toca' ? 'primario' : 'borde'} onClick={recomendar} disabled={enviando}>
            {enviando ? 'Enviando…' : recomendada ? '💬 Recordarle la descarga' : '💬 Recomendar descarga'}
          </Boton>
        )}
        <Boton variante={esEntrenador ? 'borde' : 'primario'} onClick={() => setRegistrar(true)}>
          ✅ {e.nivel === 'sin_dato' ? (esEntrenador ? 'Registrar la última descarga' : 'Registrar mi última descarga') : esEntrenador ? 'Registrar descarga hecha' : 'Ya hice la descarga'}
        </Boton>
        {esEntrenador && (
          <Boton variante="texto" onClick={() => setUmbralAbierto(true)}>
            ⚙️ Cambiar el límite ({carga.umbral_km} km)
          </Boton>
        )}
      </div>

      {historial.length > 0 && (
        <div className="mt-3 border-t border-borde pt-3">
          <p className="mb-1 text-sm font-semibold">Historial</p>
          <ul className="flex flex-col divide-y divide-borde text-sm">
            {historial.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  <span className="font-mono">{formatoFecha(d.fecha)}</span>{' '}
                  {d.estado === 'recomendada' ? <span className="text-texto-2">💬 recomendada</span> : <b>{d.tipo ? TEXTO_TIPO[d.tipo] : 'Descarga'}</b>}
                  {d.km ? <span className="text-texto-2"> · {formatoKm(d.km)} km</span> : null}
                  {d.nota && <span className="block text-xs text-texto-2">{d.nota}</span>}
                </span>
                {(esEntrenador || d.estado === 'hecha') && (
                  <button type="button" className="text-xs font-semibold text-mal" onClick={() => borrar(d.id)} aria-label={`Borrar la del ${formatoFecha(d.fecha)}`}>
                    Borrar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-3 text-xs text-texto-2">Suma todo lo corrido (con calentamiento, afloje y recuperaciones). Al registrar una descarga, vuelve a cero.</p>

      <FormDescarga
        abierta={registrar}
        alumnoId={alumnoId}
        km={carga.km}
        onCerrar={() => setRegistrar(false)}
        onGuardado={(fecha) => {
          setRegistrar(false)
          setOk(fecha === hoyPY() ? 'Descarga registrada: la carga volvió a cero.' : `Descarga registrada: ahora se cuentan los km desde el ${formatoFecha(fecha)}.`)
          recargar()
        }}
      />
      {esEntrenador && (
        <FormUmbral
          abierta={umbralAbierto}
          alumnoIds={[alumnoId]}
          actual={carga.umbral_km}
          onCerrar={() => setUmbralAbierto(false)}
          onGuardado={() => {
            setUmbralAbierto(false)
            recargar()
            onCambio?.()
          }}
        />
      )}
    </Tarjeta>
  )
}

/** Registrar una descarga hecha: fecha, con quién y una nota. */
function FormDescarga({ abierta, alumnoId, km, onCerrar, onGuardado }: { abierta: boolean; alumnoId: string; km: number; onCerrar: () => void; onGuardado: (fecha: string) => void }) {
  const hoy = hoyPY()
  const [fecha, setFecha] = useState(hoy)
  const [tipo, setTipo] = useState<TipoDescarga>('fisio')
  const [nota, setNota] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    setError('')
    if (!fecha || fecha > hoy) return setError('Elegí una fecha de hoy o anterior.')
    setGuardando(true)
    // Los km acumulados solo se guardan si es de hoy (con otra fecha, el número de hoy no sirve).
    const err = await registrarDescarga({ alumno_id: alumnoId, fecha, tipo, nota, km: fecha === hoy ? Math.round(km * 10) / 10 : null })
    setGuardando(false)
    if (err) return setError(mensajeError(err))
    setNota('')
    onGuardado(fecha)
  }

  return (
    <Hoja titulo="Registrar descarga" abierta={abierta} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <Campo id="descarga-fecha" label="¿Cuándo?" type="date" max={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <Opciones label="¿Con quién?" valor={tipo} onChange={setTipo} opciones={TIPOS_DESCARGA} />
        <AreaTexto id="descarga-nota" label="Nota (opcional)" placeholder="Ej.: gemelos cargados, trabajó isquios" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </Boton>
      </div>
    </Hoja>
  )
}

/** Límite de km entre descargas, para uno o para varios alumnos. */
export function FormUmbral({ abierta, alumnoIds, actual, onCerrar, onGuardado }: { abierta: boolean; alumnoIds: string[]; actual: number; onCerrar: () => void; onGuardado: () => void }) {
  const [valor, setValor] = useState(String(actual))
  const [error, setError] = useState('')
  const km = Math.round(Number(valor) || 0)

  async function guardar() {
    setError('')
    if (km < 30 || km > 1000) return setError('El límite va de 30 a 1000 km.')
    const err = await cambiarUmbral(alumnoIds, km)
    if (err) return setError(mensajeError(err))
    onGuardado()
  }

  return (
    <Hoja titulo={alumnoIds.length > 1 ? `Límite para ${alumnoIds.length} alumnos` : 'Límite de km entre descargas'} abierta={abierta} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-texto-2">Cada cuántos km se recomienda una descarga muscular. Si no lo cambiás, son {UMBRAL_BASE} km.</p>
        <div className="flex flex-wrap gap-2">
          {UMBRALES.map((u) => (
            <button
              key={u}
              type="button"
              aria-pressed={km === u}
              onClick={() => setValor(String(u))}
              className={`min-h-11 rounded-full border px-4 font-mono font-semibold ${km === u ? 'boton-accion border-transparent' : 'border-borde bg-superficie'}`}
            >
              {u} km
            </button>
          ))}
        </div>
        <Campo id="umbral-otro" label="Otro (km)" inputMode="numeric" value={valor} onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar}>Guardar</Boton>
      </div>
    </Hoja>
  )
}

/** Aviso en Hoy: solo cuando el entrenador la recomendó o se pasó el límite. */
export function AvisoDescarga({ alumnoId }: { alumnoId: string }) {
  const { carga } = useCarga(alumnoId)
  if (!carga) return null
  const e = estadoCarga(carga)
  if (!carga.recomendada_el && e.nivel !== 'toca') return null
  return (
    <Link to="/salud?tab=carga" className="flex items-center gap-3 rounded-2xl border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-4 py-3">
      <span className="text-3xl" aria-hidden="true">
        💆
      </span>
      <span className="flex-1">
        <span className="block font-semibold">{carga.recomendada_el ? 'Tu entrenador te recomienda una descarga' : 'Toca una descarga muscular'}</span>
        <span className="block text-sm text-texto-2">
          Llevás {formatoKm(carga.km)} km {carga.ultima_descarga ? 'desde la última' : 'en 4 semanas'} (límite {carga.umbral_km} km).
        </span>
      </span>
      <span aria-hidden="true">›</span>
    </Link>
  )
}
