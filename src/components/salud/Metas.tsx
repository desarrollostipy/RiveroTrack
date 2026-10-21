import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { diasEntre, hoyPY } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, leerDuracion, leerNumero } from '../../lib/formato'
import type { Historial } from '../../lib/historial'
import type { Meta } from '../../lib/salud'
import { Boton, Campo, Hoja, MensajeError, Opciones, Tarjeta, Titulo, Vacio } from '../ui'

const KM_DISTANCIA = { '5K': 5, '10K': 10, '21K': 21.1, '42K': 42.2 } as const

/** Mejor tiempo en una distancia: marcas personales y resultados de carreras. */
function mejorTiempo(h: Historial, distancia: keyof typeof KM_DISTANCIA) {
  const km = KM_DISTANCIA[distancia]
  const tiempos = [
    ...h.marcas.filter((m) => m.distancia === distancia).map((m) => m.tiempo_seg),
    ...h.carreras.filter((c) => c.resultado_tiempo_seg && c.distancia_km && Math.abs(c.distancia_km - km) < 0.4).map((c) => c.resultado_tiempo_seg!),
  ]
  return tiempos.length ? Math.min(...tiempos) : null
}

export function avanceMeta(m: Meta, h: Historial, hoy: string) {
  if (m.tipo === 'tiempo' && m.distancia && m.objetivo_seg) {
    const mejor = mejorTiempo(h, m.distancia)
    return {
      pct: mejor ? Math.min(1, m.objetivo_seg / mejor) : 0,
      cumplida: !!mejor && mejor <= m.objetivo_seg,
      texto: mejor ? `Tu mejor: ${formatoDuracion(mejor)} · meta ${formatoDuracion(m.objetivo_seg)}` : `Sin marca todavía · meta ${formatoDuracion(m.objetivo_seg)}`,
    }
  }
  if (m.tipo === 'km' && m.objetivo_km) {
    const hasta = m.fecha_limite && m.fecha_limite < hoy ? m.fecha_limite : hoy
    const km = h.sesiones.filter((s) => s.fecha >= m.desde && s.fecha <= hasta).reduce((t, s) => t + s.km_total, 0)
    return { pct: Math.min(1, km / m.objetivo_km), cumplida: km >= m.objetivo_km, texto: `${formatoKm(km)} de ${formatoKm(m.objetivo_km)} km desde el ${formatoFecha(m.desde)}` }
  }
  return { pct: m.cumplida_at ? 1 : 0, cumplida: !!m.cumplida_at, texto: m.cumplida_at ? '¡Cumplida!' : 'La marcás vos cuando la logres' }
}

/** Metas personales con barra de avance y cuenta regresiva. */
export function Metas({ alumnoId, h, editable = true }: { alumnoId: string; h: Historial; editable?: boolean }) {
  const hoy = hoyPY()
  const [metas, setMetas] = useState<Meta[] | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [tipo, setTipo] = useState<Meta['tipo']>('tiempo')
  const [distancia, setDistancia] = useState<keyof typeof KM_DISTANCIA>('10K')
  const [tiempo, setTiempo] = useState('')
  const [km, setKm] = useState('')
  const [titulo, setTitulo] = useState('')
  const [limite, setLimite] = useState('')
  const [error, setError] = useState('')
  const intentadas = useRef(new Set<string>())

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('metas_personales').select('*').eq('alumno_id', alumnoId).order('created_at')
    setMetas((data ?? []) as Meta[])
  }, [alumnoId])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Si una meta se cumplió sola (por una marca o los km), queda registrada.
  useEffect(() => {
    if (!editable || !metas) return
    const nuevas = metas.filter((m) => !m.cumplida_at && m.tipo !== 'libre' && !intentadas.current.has(m.id) && avanceMeta(m, h, hoy).cumplida)
    nuevas.forEach((m) => intentadas.current.add(m.id))
    if (nuevas.length)
      supabase
        .from('metas_personales')
        .update({ cumplida_at: new Date().toISOString() })
        .in('id', nuevas.map((m) => m.id))
        .then(() => cargar())
  }, [metas, h, hoy, editable, cargar])

  async function crear() {
    const seg = tipo === 'tiempo' ? leerDuracion(tiempo) : null
    const kmObj = tipo === 'km' ? leerNumero(km) : null
    if (tipo === 'tiempo' && !seg) return setError('Escribí el tiempo, por ejemplo 49:59 o 1:45:00.')
    if (tipo === 'km' && (!kmObj || kmObj <= 0)) return setError('Escribí cuántos km.')
    const nombre = titulo.trim() || (tipo === 'tiempo' ? `Bajar de ${formatoDuracion(seg!)} en ${distancia}` : tipo === 'km' ? `Correr ${formatoKm(kmObj!)} km` : '')
    if (!nombre) return setError('Poné un título a tu meta.')
    if (limite && limite <= hoy) return setError('La fecha límite tiene que ser futura.')
    const { error } = await supabase.from('metas_personales').insert({
      alumno_id: alumnoId,
      titulo: nombre,
      tipo,
      distancia: tipo === 'tiempo' ? distancia : null,
      objetivo_seg: seg,
      objetivo_km: kmObj,
      fecha_limite: limite || null,
    })
    if (error) return setError(mensajeError(error))
    setAbierta(false)
    setTitulo('')
    setTiempo('')
    setKm('')
    setLimite('')
    setError('')
    cargar()
  }

  async function marcar(m: Meta) {
    await supabase.from('metas_personales').update({ cumplida_at: m.cumplida_at ? null : new Date().toISOString() }).eq('id', m.id)
    cargar()
  }

  async function borrar(m: Meta) {
    if (!confirm(`¿Borrar la meta "${m.titulo}"?`)) return
    await supabase.from('metas_personales').delete().eq('id', m.id)
    cargar()
  }

  if (!metas) return null
  const orden = [...metas].sort((a, b) => Number(!!a.cumplida_at) - Number(!!b.cumplida_at))

  return (
    <Tarjeta>
      <Titulo accion={editable ? <Boton variante="texto" onClick={() => setAbierta(true)}>+ Nueva</Boton> : undefined}>🎯 Mis metas</Titulo>
      {orden.length === 0 ? (
        <Vacio>{editable ? '¿Qué querés lograr? Por ejemplo: bajar de 50 minutos en 10K para marzo.' : 'Sin metas cargadas.'}</Vacio>
      ) : (
        <ul className="flex flex-col gap-2">
          {orden.map((m) => {
            const a = avanceMeta(m, h, hoy)
            const faltan = m.fecha_limite ? diasEntre(hoy, m.fecha_limite) : null
            const cumplida = !!m.cumplida_at || a.cumplida
            return (
              <li key={m.id} className={`rounded-2xl border-2 p-3 ${cumplida ? 'border-ok bg-linear-to-br from-ok/15 to-transparent' : 'border-borde'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{m.titulo}</p>
                    <p className="text-sm text-texto-2">{a.texto}</p>
                  </div>
                  {cumplida ? (
                    <span className="shrink-0 font-semibold text-ok">✓ ¡Lograda!</span>
                  ) : faltan !== null ? (
                    <span className={`shrink-0 rounded-xl px-2 py-1 text-center ${faltan < 0 ? 'bg-mal/10 text-mal' : 'bg-azul/10 text-azul'}`}>
                      <span className="block font-titulo text-xl font-extrabold leading-none">{Math.abs(faltan)}</span>
                      <span className="text-[0.65rem] font-semibold">{faltan < 0 ? 'días tarde' : 'días'}</span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-borde">
                  <div className={`h-full rounded-full ${cumplida ? 'bg-ok' : 'bg-azul'}`} style={{ width: `${Math.round(a.pct * 100)}%` }} />
                </div>
                {editable && (
                  <div className="mt-2 flex gap-3 text-sm font-semibold">
                    {m.tipo === 'libre' && (
                      <button type="button" className="text-azul" onClick={() => marcar(m)}>
                        {m.cumplida_at ? 'Desmarcar' : '✓ La cumplí'}
                      </button>
                    )}
                    <button type="button" className="text-texto-2" onClick={() => borrar(m)}>
                      Borrar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <Hoja titulo="Nueva meta" abierta={abierta} onCerrar={() => setAbierta(false)}>
        <Opciones
          label="Tipo de meta"
          valor={tipo}
          onChange={setTipo}
          opciones={[
            { valor: 'tiempo', texto: '⏱️ Un tiempo' },
            { valor: 'km', texto: '📏 Kilómetros' },
            { valor: 'libre', texto: '✍️ Otra' },
          ]}
        />
        {tipo === 'tiempo' && (
          <>
            <Opciones label="Distancia" valor={distancia} onChange={setDistancia} opciones={(['5K', '10K', '21K', '42K'] as const).map((d) => ({ valor: d, texto: d }))} />
            <Campo id="meta-tiempo" label="Bajar de" placeholder="49:59" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
          </>
        )}
        {tipo === 'km' && <Campo id="meta-km" label="Kilómetros a sumar" inputMode="decimal" placeholder="300" value={km} onChange={(e) => setKm(e.target.value)} />}
        <Campo
          id="meta-titulo"
          label={tipo === 'libre' ? 'Mi meta' : 'Título (opcional)'}
          placeholder={tipo === 'libre' ? 'Ej.: Terminar mi primera media maratón' : 'Se arma solo si lo dejás vacío'}
          value={titulo}
          maxLength={80}
          onChange={(e) => setTitulo(e.target.value)}
        />
        <Campo id="meta-limite" type="date" label="Fecha límite (opcional)" value={limite} min={hoy} onChange={(e) => setLimite(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={crear}>Crear meta</Boton>
      </Hoja>
    </Tarjeta>
  )
}
