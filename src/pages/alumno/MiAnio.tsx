import { useState } from 'react'
import { useMiAlumno } from '../../lib/alumno'
import { calcularLogros, useHistorial } from '../../components/Logros'
import { resumenAnio } from '../../lib/comunidad'
import { hoyPY, lunesDe, sumarDias } from '../../lib/fechas'
import type { Historial } from '../../lib/historial'
import { formatoFecha, formatoKm, formatoRitmo } from '../../lib/formato'
import { tarjetaLista } from '../../lib/tarjetas'
import { Pantalla } from '../../components/Pantalla'
import { BotonCompartir } from '../../components/Compartir'
import { Cargando, SelectorPeriodo, Tarjeta, Vacio } from '../../components/ui'

const NIVELES = ['var(--color-borde)', 'rgba(200,255,61,0.28)', 'rgba(200,255,61,0.5)', 'rgba(200,255,61,0.75)', '#C8FF3D']
const MESES_CORTOS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** Un cuadrito por día del año: más color, más km. Se ve la constancia de un vistazo. */
export function MapaAnio({ h, anio }: { h: Historial; anio: number }) {
  const porDia = new Map<string, number>()
  for (const s of h.sesiones) if (s.fecha.startsWith(String(anio))) porDia.set(s.fecha, (porDia.get(s.fecha) ?? 0) + Math.max(s.km_total, 0.1))
  const hoy = hoyPY()
  const inicio = lunesDe(`${anio}-01-01`)
  const fin = `${anio}-12-31`
  const semanas: string[][] = []
  for (let l = inicio; l <= fin; l = sumarDias(l, 7)) semanas.push(Array.from({ length: 7 }, (_, i) => sumarDias(l, i)))
  const nivel = (km: number | undefined) => (!km ? 0 : km < 5 ? 1 : km < 10 ? 2 : km < 16 ? 3 : 4)
  const dias = porDia.size
  return (
    <Tarjeta>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="font-semibold">Días entrenados</p>
        <p className="font-mono text-sm text-texto-2">
          <b className="text-tinta">{dias}</b> días
        </p>
      </div>
      {/* Arranca mostrando lo más reciente (a la derecha). */}
      <div className="overflow-x-auto pb-1" ref={(el) => {
          if (el) el.scrollLeft = el.scrollWidth
        }}>
        <div className="flex gap-[3px]" role="img" aria-label={`Calendario del ${anio}: ${dias} días con entrenamiento`}>
          {semanas.map((sem) => {
            // La letra del mes va en la semana donde cae el día 1.
            const primero = sem.find((d) => d.endsWith('-01') && d.startsWith(String(anio)))
            return (
              <div key={sem[0]} className="flex flex-col gap-[3px]">
                <span className="h-3 w-[11px] overflow-visible whitespace-nowrap text-[0.55rem] leading-3 text-texto-2">{primero ? MESES_CORTOS[Number(primero.slice(5, 7)) - 1] : ''}</span>
                {sem.map((d) => {
                  const fuera = !d.startsWith(String(anio)) || d > hoy
                  const km = porDia.get(d)
                  return (
                    <span
                      key={d}
                      title={km ? `${formatoFecha(d)}: ${formatoKm(km)} km` : formatoFecha(d)}
                      className="h-[11px] w-[11px] rounded-[3px]"
                      style={{ background: fuera ? 'transparent' : NIVELES[nivel(km)], boxShadow: nivel(km) === 4 ? '0 0 6px rgba(200,255,61,0.6)' : undefined }}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-2 flex items-center justify-end gap-1 text-[0.65rem] text-texto-2">
        Menos
        {NIVELES.map((c) => (
          <span key={c} className="h-[10px] w-[10px] rounded-[3px]" style={{ background: c }} />
        ))}
        Más km
      </p>
    </Tarjeta>
  )
}

/** "Mi año": los números del año, para mirar y compartir (estilo resumen anual). */
export default function MiAnio() {
  const { alumno } = useMiAlumno()
  const h = useHistorial(alumno.id)
  const actual = Number(hoyPY().slice(0, 4))
  const [anio, setAnio] = useState(actual)

  if (!h) return <Cargando pantalla />
  const r = resumenAnio(h, anio)
  const logros = calcularLogros(h).logros.filter((l) => l.logrado).length
  const max = Math.max(1, ...r.porMes.map((m) => m.km))
  const datos = [
    { icono: '🏃', texto: 'Sesiones', valor: String(r.sesiones) },
    { icono: '⏱️', texto: 'Horas', valor: `${r.horas} h` },
    { icono: '📅', texto: 'Días', valor: String(r.dias) },
    { icono: '⚡', texto: 'Ritmo prom.', valor: r.ritmo ? `${formatoRitmo(r.ritmo)}/km` : '—' },
    { icono: '🛣️', texto: 'Más larga', valor: r.larga ? `${formatoKm(r.larga.km)} km` : '—' },
    { icono: '🗓️', texto: r.mejorMes ? `Mejor mes (${r.mejorMes.km} km)` : 'Mejor mes', valor: r.mejorMes ? r.mejorMes.nombre[0].toUpperCase() + r.mejorMes.nombre.slice(1, 3) : '—' },
    { icono: '🏁', texto: 'Carreras', valor: String(r.carreras) },
    { icono: '📍', texto: 'Grupales', valor: String(r.grupales) },
    { icono: '🔥', texto: 'Mejor racha', valor: `${r.racha} sem.` },
    { icono: '🏅', texto: 'Logros', valor: String(logros) },
  ]

  return (
    <Pantalla titulo="Mi año" volver="/progreso">
      <SelectorPeriodo
        texto={String(anio)}
        detalle={anio === actual ? 'Hasta hoy' : null}
        onAnterior={() => setAnio(anio - 1)}
        onSiguiente={() => anio < actual && setAnio(anio + 1)}
      />
      {r.sesiones === 0 ? (
        <Vacio>No hay sesiones registradas en {anio}.</Vacio>
      ) : (
        <>
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#071330] via-marino to-azul p-6 text-white shadow-lg">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/70">Tu {anio} en Rivero</p>
            <p className="mt-2 font-titulo text-7xl font-extrabold leading-none">{formatoKm(r.km)}</p>
            <p className="font-titulo text-2xl font-bold text-[#7EA6FF]">kilómetros</p>
            {r.encarnaciones >= 0.3 && (
              <p className="mt-3 text-sm text-white/85">
                {r.encarnaciones >= 1
                  ? `¡Es como ir ${r.encarnaciones >= 2 ? `${formatoKm(r.encarnaciones)} veces` : 'una vez'} de Asunción a Encarnación corriendo! 🏃`
                  : `¡Ya hiciste el ${Math.round(r.encarnaciones * 100)}% del camino de Asunción a Encarnación! 🏃`}
              </p>
            )}
          </div>

          <MapaAnio h={h} anio={anio} />

          <Tarjeta>
            <p className="mb-2 font-semibold">Km por mes</p>
            <div className="flex h-32 gap-1" role="img" aria-label="Kilómetros por mes">
              {r.porMes.map((m) => (
                <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[0.6rem] font-semibold text-texto-2">{m.km || ''}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className={`w-full rounded-t-md ${r.mejorMes && m.km === Math.round(r.mejorMes.km) ? 'bg-azul' : 'bg-azul/40'}`}
                      style={{ height: m.km ? `${Math.max(6, (m.km / max) * 100)}%` : '3px' }}
                    />
                  </div>
                  <span className="text-[0.6rem] text-texto-2">{m.mes}</span>
                </div>
              ))}
            </div>
          </Tarjeta>

          <ul className="grid grid-cols-2 gap-2">
            {datos.map((d) => (
              <li key={d.texto} className="flex items-center gap-3 rounded-full bg-superficie py-2 pl-2 pr-4 shadow-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-azul text-xl" aria-hidden="true">
                  {d.icono}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-mono text-lg font-bold leading-tight">{d.valor}</span>
                  <span className="block text-[0.65rem] font-semibold uppercase leading-tight text-texto-2">{d.texto}</span>
                </span>
              </li>
            ))}
          </ul>
          {r.larga && <p className="text-center text-xs text-texto-2">Sesión más larga: el {formatoFecha(r.larga.fecha)}.</p>}

          <BotonCompartir
            variante="primario"
            className="w-full"
            nombreArchivo={`rivero-mi-${anio}.png`}
            etiqueta={`📤 Compartir mi ${anio}`}
            generar={(estilo) =>
              tarjetaLista({
                estilo,
                nombre: alumno.nombre,
                titulo: `Mi ${anio}`,
                subtitulo: anio === actual ? `Hasta el ${formatoFecha(hoyPY())}` : String(anio),
                destacado: `${formatoKm(r.km)} km · ${r.sesiones} sesiones · ${r.horas} h`,
                grafico: { titulo: 'Km por mes', barras: r.porMes.map((m) => ({ etiqueta: m.mes.slice(0, 1).toUpperCase(), valor: m.km, texto: '' })) },
                mosaico: true,
                filas: datos.slice(2, 10).map((d) => ({ icono: d.icono, texto: d.texto, valor: d.valor })),
              })
            }
          />
        </>
      )}
    </Pantalla>
  )
}
