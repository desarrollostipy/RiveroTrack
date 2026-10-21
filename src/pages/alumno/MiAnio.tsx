import { useState } from 'react'
import { useMiAlumno } from '../../lib/alumno'
import { calcularLogros, useHistorial } from '../../components/Logros'
import { resumenAnio } from '../../lib/comunidad'
import { hoyPY } from '../../lib/fechas'
import { formatoFecha, formatoKm, formatoRitmo } from '../../lib/formato'
import { tarjetaLista } from '../../lib/tarjetas'
import { Pantalla } from '../../components/Pantalla'
import { BotonCompartir } from '../../components/Compartir'
import { Cargando, SelectorPeriodo, Tarjeta, Vacio } from '../../components/ui'

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
