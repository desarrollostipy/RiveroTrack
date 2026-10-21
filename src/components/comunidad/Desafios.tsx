import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { hoyPY, nombreMes, primerDiaMes, sumarMeses } from '../../lib/fechas'
import { formatoFecha, formatoKm } from '../../lib/formato'
import { avanceDesafio, TIPOS_DESAFIO, type Desafio } from '../../lib/comunidad'
import type { Historial } from '../../lib/historial'
import { tarjetaLogro } from '../../lib/tarjetas'
import { BotonCompartir } from '../Compartir'
import { Tarjeta, Titulo } from '../ui'

const mesTexto = (mes: string) => `${nombreMes(mes)} ${mes.slice(0, 4)}`

/** Desafíos del mes (los crea el entrenador) e insignias ganadas en meses anteriores. */
export function DesafiosAlumno({ h, nombre }: { h: Historial; nombre: string }) {
  const mesActual = primerDiaMes(hoyPY())
  const [lista, setLista] = useState<Desafio[] | null>(null)

  useEffect(() => {
    supabase
      .from('desafios')
      .select('*')
      .gte('mes', sumarMeses(mesActual, -12))
      .lte('mes', mesActual)
      .order('mes', { ascending: false })
      .then(({ data }) => setLista((data ?? []) as Desafio[]))
  }, [mesActual])

  if (!lista || lista.length === 0) return null
  const actuales = lista.filter((d) => d.mes === mesActual)
  const ganadas = lista.filter((d) => d.mes < mesActual && avanceDesafio(d, h).cumplido)

  return (
    <Tarjeta>
      <Titulo>🎖️ Desafíos del mes</Titulo>
      {actuales.length === 0 && <p className="text-sm text-texto-2">Este mes todavía no hay desafíos. ¡Atento a tu entrenador!</p>}
      <ul className="flex flex-col gap-2">
        {actuales.map((d) => {
          const a = avanceDesafio(d, h)
          const unidad = TIPOS_DESAFIO[d.tipo].unidad
          return (
            <li key={d.id} className={`rounded-2xl border-2 p-3 ${a.cumplido ? 'border-ok bg-linear-to-br from-ok/15 to-transparent' : 'border-borde'}`}>
              <div className="flex items-center gap-3">
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl ${a.cumplido ? 'bg-ok/20' : 'bg-fondo grayscale'}`} aria-hidden="true">
                  {d.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.titulo}</p>
                  <p className="text-sm text-texto-2">{d.descripcion ?? TIPOS_DESAFIO[d.tipo].texto}</p>
                </div>
                <span className={`shrink-0 font-mono text-sm font-semibold ${a.cumplido ? 'text-ok' : ''}`}>
                  {a.cumplido ? '✓ ¡Ganada!' : `${formatoKm(a.actual)}/${formatoKm(a.meta)} ${unidad}`}
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-borde">
                <div className={`h-full rounded-full ${a.cumplido ? 'bg-ok' : 'bg-azul'}`} style={{ width: `${a.pct * 100}%` }} />
              </div>
              {a.cumplido && (
                <BotonCompartir
                  variante="texto"
                  className="mt-1"
                  nombreArchivo="rivero-insignia.png"
                  etiqueta="📤 Compartir insignia"
                  generar={(estilo) => tarjetaLogro({ estilo, nombre, icono: d.emoji, titulo: d.titulo, detalle: `Desafío de ${mesTexto(d.mes)}`, fecha: formatoFecha(hoyPY()) })}
                />
              )}
            </li>
          )
        })}
      </ul>

      {ganadas.length > 0 && (
        <>
          <p className="mb-2 mt-4 text-sm font-semibold text-texto-2">Insignias ganadas</p>
          <ul className="grid grid-cols-4 gap-2">
            {ganadas.map((d) => (
              <li key={d.id} className="flex flex-col items-center gap-1 rounded-xl bg-linear-to-br from-parcial/30 to-transparent p-2 text-center" title={d.titulo}>
                <span className="text-3xl" aria-hidden="true">
                  {d.emoji}
                </span>
                <span className="text-[0.65rem] font-semibold leading-tight">{d.titulo}</span>
                <span className="text-[0.6rem] text-texto-2">{nombreMes(d.mes).slice(0, 3)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Tarjeta>
  )
}
