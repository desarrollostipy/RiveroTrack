import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { hoyPY, nombreMes, primerDiaMes, sumarMeses } from '../../lib/fechas'
import { formatoKm, leerNumero } from '../../lib/formato'
import { useGrupos } from '../../lib/grupos'
import { TIPOS_DESAFIO, type Desafio, type TipoDesafio } from '../../lib/comunidad'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Campo, Cargando, Hoja, MensajeError, Opciones, Selector, Tarjeta, Vacio } from '../../components/ui'
import { EtiquetaGrupo } from './Grupos'

const EMOJIS = ['🏅', '🔥', '🚀', '⚡', '💪', '🏆', '🌟', '🎯', '🌅', '❄️', '🎄', '🇵🇾']
const SUGERENCIAS: { titulo: string; emoji: string; tipo: TipoDesafio; meta: number }[] = [
  { titulo: '100 km este mes', emoji: '🔥', tipo: 'km', meta: 100 },
  { titulo: '16 sesiones', emoji: '💪', tipo: 'sesiones', meta: 16 },
  { titulo: '20 días entrenando', emoji: '📅', tipo: 'dias', meta: 20 },
  { titulo: 'Presente en 4 grupales', emoji: '📍', tipo: 'grupales', meta: 4 },
]

/** Desafíos del mes: el entrenador los crea y los alumnos ganan la insignia. */
export default function Desafios() {
  const hoy = hoyPY()
  const mesActual = primerDiaMes(hoy)
  const { grupos, grupo } = useGrupos()
  const [lista, setLista] = useState<Desafio[] | null>(null)
  const [abierta, setAbierta] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [emoji, setEmoji] = useState('🏅')
  const [descripcion, setDescripcion] = useState('')
  const [tipo, setTipo] = useState<TipoDesafio>('km')
  const [meta, setMeta] = useState('')
  const [mes, setMes] = useState(mesActual)
  const [grupoId, setGrupoId] = useState('')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('desafios').select('*').gte('mes', sumarMeses(mesActual, -6)).order('mes', { ascending: false }).order('created_at')
    setLista((data ?? []) as Desafio[])
  }, [mesActual])

  useEffect(() => {
    cargar()
  }, [cargar])

  function abrir(s?: (typeof SUGERENCIAS)[number]) {
    setTitulo(s ? `${nombreMes(mesActual)}: ${s.titulo}` : '')
    setEmoji(s?.emoji ?? '🏅')
    setTipo(s?.tipo ?? 'km')
    setMeta(s ? String(s.meta) : '')
    setDescripcion('')
    setMes(mesActual)
    setGrupoId('')
    setError('')
    setAbierta(true)
  }

  async function crear() {
    const m = leerNumero(meta)
    if (!titulo.trim()) return setError('Poné un título.')
    if (!m || m <= 0) return setError('Poné la meta, por ejemplo 100.')
    const { error } = await supabase.from('desafios').insert({ titulo: titulo.trim(), emoji, descripcion: descripcion.trim() || null, tipo, meta: m, mes, grupo_id: grupoId || null })
    if (error) return setError(mensajeError(error))
    setAbierta(false)
    cargar()
  }

  async function borrar(d: Desafio) {
    if (!confirm(`¿Borrar el desafío "${d.titulo}"?`)) return
    await supabase.from('desafios').delete().eq('id', d.id)
    cargar()
  }

  const porMes = (lista ?? []).reduce<Record<string, Desafio[]>>((acc, d) => ((acc[d.mes] ??= []).push(d), acc), {})

  return (
    <Pantalla titulo="🎖️ Desafíos del mes" subtitulo="Los alumnos ganan una insignia al cumplirlos" volver="/herramientas" derecha={<Boton onClick={() => abrir()}>+ Nuevo</Boton>}>
      <Tarjeta>
        <p className="mb-2 text-sm font-semibold text-texto-2">Ideas rápidas</p>
        <div className="flex flex-wrap gap-2">
          {SUGERENCIAS.map((s) => (
            <button key={s.titulo} type="button" onClick={() => abrir(s)} className="rounded-full border border-borde bg-superficie px-3 py-1.5 text-sm font-semibold hover:border-azul">
              {s.emoji} {s.titulo}
            </button>
          ))}
        </div>
      </Tarjeta>

      {lista === null ? (
        <Cargando />
      ) : lista.length === 0 ? (
        <Vacio>Todavía no hay desafíos. Creá el primero con una de las ideas de arriba.</Vacio>
      ) : (
        Object.entries(porMes).map(([m, ds]) => (
          <section key={m}>
            <h2 className="mb-2 font-titulo text-lg font-bold">
              {nombreMes(m)} {m.slice(0, 4)} {m === mesActual && <span className="text-sm font-normal text-azul">· este mes</span>}
            </h2>
            <ul className="flex flex-col gap-2">
              {ds.map((d) => (
                <li key={d.id}>
                  <Tarjeta className="flex items-center gap-3">
                    <span className="text-3xl" aria-hidden="true">
                      {d.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{d.titulo}</p>
                      <p className="text-sm text-texto-2">
                        {TIPOS_DESAFIO[d.tipo].texto}: {formatoKm(Number(d.meta))} {TIPOS_DESAFIO[d.tipo].unidad}
                      </p>
                      <EtiquetaGrupo grupo={grupo(d.grupo_id)} />
                    </div>
                    <Boton variante="texto" onClick={() => borrar(d)}>
                      Borrar
                    </Boton>
                  </Tarjeta>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Hoja titulo="Nuevo desafío" abierta={abierta} onCerrar={() => setAbierta(false)}>
        <div>
          <p className="mb-1 text-sm font-semibold">Insignia</p>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                aria-pressed={emoji === e}
                onClick={() => setEmoji(e)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl border-2 text-2xl ${emoji === e ? 'border-azul bg-azul/10' : 'border-borde'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
        <Campo id="d-titulo" label="Título" placeholder="Ej.: Octubre 100 km" value={titulo} maxLength={60} onChange={(e) => setTitulo(e.target.value)} />
        <Opciones label="Qué se mide" valor={tipo} onChange={setTipo} opciones={(Object.keys(TIPOS_DESAFIO) as TipoDesafio[]).map((t) => ({ valor: t, texto: TIPOS_DESAFIO[t].texto }))} />
        <Campo id="d-meta" label={`Meta (${TIPOS_DESAFIO[tipo].unidad})`} inputMode="decimal" value={meta} onChange={(e) => setMeta(e.target.value)} />
        <Opciones
          label="Mes"
          valor={mes}
          onChange={setMes}
          opciones={[mesActual, sumarMeses(mesActual, 1)].map((m) => ({ valor: m, texto: `${nombreMes(m)}${m === mesActual ? ' (este)' : ''}` }))}
        />
        <Selector id="d-grupo" label="Para" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
          <option value="">Todos los alumnos</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </Selector>
        <Campo id="d-desc" label="Descripción (opcional)" placeholder="Ej.: ¡Sumemos km antes del verano!" value={descripcion} maxLength={200} onChange={(e) => setDescripcion(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={crear}>Crear desafío</Boton>
      </Hoja>
    </Pantalla>
  )
}
