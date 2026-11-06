import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { hoyPY, nombreMes, primerDiaMes, sumarMeses } from '../../lib/fechas'
import { formatoKm } from '../../lib/formato'
import type { FilaRanking } from '../../lib/comunidad'
import { tarjetaLista, tarjetaLogro } from '../../lib/tarjetas'
import { BotonCompartir } from '../Compartir'
import { Avatar, Cargando, Pestanas, SelectorPeriodo, Tarjeta, Vacio } from '../ui'

type Criterio = 'km' | 'sesiones' | 'dias'
const CRITERIOS: { valor: Criterio; texto: string }[] = [
  { valor: 'km', texto: '📏 Km' },
  { valor: 'sesiones', texto: '🏃 Sesiones' },
  { valor: 'dias', texto: '📅 Constancia' },
]
const MEDALLAS = ['🥇', '🥈', '🥉']
const valorDe = (f: FilaRanking, c: Criterio) => (c === 'km' ? Number(f.km) : c === 'sesiones' ? f.sesiones : f.dias)
const textoDe = (f: FilaRanking, c: Criterio) => (c === 'km' ? `${formatoKm(Number(f.km))} km` : c === 'sesiones' ? `${f.sesiones} ses.` : `${f.dias} días`)

/** Podio animado: el 2.º, el 1.º y el 3.º suben uno tras otro. */
function Podio({ filas, texto }: { filas: FilaRanking[]; texto: (f: FilaRanking) => string }) {
  const lugares = [
    { f: filas[1], puesto: 2, alto: 'h-24', color: 'linear-gradient(180deg,#D7DEEA,#8E9BB3)', retraso: '0.15s' },
    { f: filas[0], puesto: 1, alto: 'h-32', color: 'linear-gradient(180deg,#FFE08A,#E3A21A)', retraso: '0.35s' },
    { f: filas[2], puesto: 3, alto: 'h-16', color: 'linear-gradient(180deg,#F2B48A,#B8692E)', retraso: '0s' },
  ]
  return (
    <div className="flex items-end justify-center gap-2 rounded-3xl border border-borde bg-superficie px-3 pb-0 pt-4" aria-label="Podio del mes">
      {lugares.map(({ f, puesto, alto, color, retraso }) => (
        <div key={puesto} className="flex w-1/3 flex-col items-center">
          {f ? (
            <>
              <div className="relative mb-1 animate-pop" style={{ animationDelay: `calc(${retraso} + 0.35s)` }}>
                <Avatar url={f.avatar_url} nombre={f.nombre} tam={puesto === 1 ? 58 : 46} className={puesto === 1 ? 'ring-4 ring-[#F2B544]' : 'ring-2 ring-borde'} />
                {puesto === 1 && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl" aria-hidden="true">
                    👑
                  </span>
                )}
              </div>
              <p className={`w-full truncate text-center text-sm font-semibold ${f.es_yo ? 'text-azul' : ''}`}>
                {f.nombre.split(' ')[0]}
                {f.es_yo ? ' (vos)' : ''}
              </p>
              <p className="mb-1 font-mono text-xs text-texto-2">{texto(f)}</p>
            </>
          ) : (
            <div className="h-20" />
          )}
          <div
            className={`flex w-full origin-bottom items-start justify-center rounded-t-2xl pt-1 font-titulo text-2xl font-black text-[#1B1300] ${alto}`}
            style={{ background: f ? color : 'var(--color-borde)', animation: `subir 0.6s cubic-bezier(.2,.9,.3,1.2) ${retraso} both` }}
          >
            {f ? MEDALLAS[puesto - 1] : ''}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Ranking del mes. El alumno elige si aparece; el entrenador ve a todos. */
export function Ranking({ modo }: { modo: 'alumno' | 'entrenador' }) {
  const hoy = hoyPY()
  const [mes, setMes] = useState(primerDiaMes(hoy))
  const [criterio, setCriterio] = useState<Criterio>('km')
  const [filas, setFilas] = useState<FilaRanking[] | null>(null)

  const cargar = useCallback(async () => {
    setFilas(null)
    const { data } = await supabase.rpc('ranking_mes', { p_mes: mes })
    setFilas(((data ?? []) as FilaRanking[]).map((f) => ({ ...f, km: Number(f.km) })))
  }, [mes])

  useEffect(() => {
    cargar()
  }, [cargar])

  const yo = filas?.find((f) => f.es_yo)
  // Solo cuentan los que aparecen; si el alumno se ocultó, se ve igual pero sin puesto.
  const ordenadas = (filas ?? [])
    .filter((f) => f.visible || modo === 'entrenador')
    .filter((f) => valorDe(f, criterio) > 0)
    .sort((a, b) => valorDe(b, criterio) - valorDe(a, criterio) || a.nombre.localeCompare(b.nombre))
  const max = Math.max(1, ...ordenadas.map((f) => valorDe(f, criterio)))
  const miPuesto = yo && yo.visible ? ordenadas.findIndex((f) => f.es_yo) + 1 : 0
  const titulo = `${nombreMes(mes)[0].toUpperCase()}${nombreMes(mes).slice(1)} ${mes.slice(0, 4)}`

  async function cambiarVisible(v: boolean) {
    await supabase.rpc('set_mi_ranking', { p_visible: v })
    cargar()
  }

  return (
    <div className="flex flex-col gap-3">
      <SelectorPeriodo
        texto={titulo}
        detalle={mes === primerDiaMes(hoy) ? 'Mes actual' : null}
        onAnterior={() => setMes(sumarMeses(mes, -1))}
        onSiguiente={() => mes < primerDiaMes(hoy) && setMes(sumarMeses(mes, 1))}
      />
      <Pestanas valor={criterio} onChange={setCriterio} opciones={CRITERIOS} />

      {modo === 'alumno' && yo && (
        <Tarjeta className="flex items-center justify-between gap-3">
          <div>
            {yo.visible ? (
              <>
                <p className="text-sm text-texto-2">Tu puesto</p>
                <p className="font-titulo text-3xl font-extrabold text-azul">{miPuesto ? `#${miPuesto}` : '—'}</p>
              </>
            ) : (
              <p className="text-sm text-texto-2">No aparecés en el ranking. Tus datos los ves solo vos.</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5 accent-[var(--color-azul)]" checked={yo.visible} onChange={(e) => cambiarVisible(e.target.checked)} />
            Aparecer
          </label>
        </Tarjeta>
      )}

      {filas === null ? (
        <Cargando />
      ) : ordenadas.length === 0 ? (
        <Vacio>Todavía nadie registró sesiones este mes.</Vacio>
      ) : (
        <>
        <Podio key={`${mes}-${criterio}`} filas={ordenadas.slice(0, 3)} texto={(f) => textoDe(f, criterio)} />
        {ordenadas.length > 3 && (
        <Tarjeta className="p-0">
          <ol className="divide-y divide-borde">
            {ordenadas.map((f, i) => i < 3 ? null : (
              <li key={f.alumno_id} className={`flex items-center gap-3 px-3 py-2.5 ${f.es_yo ? 'bg-azul/10' : ''} ${!f.visible ? 'opacity-50' : ''}`}>
                <span className="w-8 shrink-0 text-center font-titulo text-lg font-extrabold">{MEDALLAS[i] ?? i + 1}</span>
                <Avatar url={f.avatar_url} nombre={f.nombre} tam={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {f.nombre}
                    {f.es_yo && ' (vos)'}
                    {!f.visible && <span className="text-xs font-normal text-texto-2"> · oculto</span>}
                  </p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-borde">
                    <div className={`h-full rounded-full ${i < 3 ? 'bg-azul' : 'bg-azul/50'}`} style={{ width: `${(100 * valorDe(f, criterio)) / max}%` }} />
                  </div>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold">{textoDe(f, criterio)}</span>
              </li>
            ))}
          </ol>
        </Tarjeta>
        )}
        </>
      )}

      {modo === 'alumno' && yo && miPuesto > 0 && (
        <BotonCompartir
          className="w-full"
          nombreArchivo={`rivero-mi-puesto-${mes.slice(0, 7)}.png`}
          etiqueta="📤 Compartir mi puesto"
          generar={(estilo) =>
            tarjetaLogro({
              estilo,
              nombre: yo.nombre,
              icono: MEDALLAS[miPuesto - 1] ?? '🏅',
              titulo: `Puesto #${miPuesto}`,
              detalle: `Ranking de ${titulo.toLowerCase()} · ${textoDe(yo, criterio)}`,
              fecha: titulo,
            })
          }
        />
      )}
      {/* La lista con nombres solo la comparte el entrenador: aparecer en la app no es aceptar salir en redes. */}
      {modo === 'entrenador' && ordenadas.length > 0 && (
        <BotonCompartir
          className="w-full"
          nombreArchivo={`rivero-ranking-${mes.slice(0, 7)}.png`}
          etiqueta="📤 Compartir el ranking"
          generar={(estilo) =>
            tarjetaLista({
              estilo,
              nombre: 'Equipo Rivero',
              titulo: 'Ranking del mes',
              subtitulo: titulo,
              destacado: CRITERIOS.find((c) => c.valor === criterio)!.texto.slice(3),
              filas: ordenadas
                .filter((f) => f.visible)
                .slice(0, 8)
                .map((f, i) => ({ icono: MEDALLAS[i] ?? `${i + 1}.`, texto: f.nombre, valor: textoDe(f, criterio) })),
            })
          }
        />
      )}
      <p className="text-center text-xs text-texto-2">Constancia = días distintos con al menos una sesión registrada.</p>
    </div>
  )
}
