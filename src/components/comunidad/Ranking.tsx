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
        <Tarjeta className="p-0">
          <ol className="divide-y divide-borde">
            {ordenadas.map((f, i) => (
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
