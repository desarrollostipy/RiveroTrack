import { useEffect, useState } from 'react'
import { cargarHistorial, historialEnMemoria, rachas, type Historial } from '../lib/historial'
import { hoyPY } from '../lib/fechas'
import { formatoFecha, formatoKm } from '../lib/formato'
import { tarjetaLogro } from '../lib/tarjetas'
import { BotonCompartir } from './Compartir'
import { Cargando, Tarjeta, Titulo } from './ui'

type Logro = { icono: string; nombre: string; detalle: string; logrado: boolean; actual: number; meta: number; color: string }

export function calcularLogros(h: Historial) {
  const n = h.sesiones.length
  const km = h.sesiones.reduce((t, s) => t + s.km_total, 0)
  const largo = Math.max(0, ...h.sesiones.map((s) => s.km_total))
  const corridas = h.carreras.filter((c) => c.resultado_tiempo_seg)
  const objetivo = corridas.some((c) => c.tiempo_objetivo_seg && c.resultado_tiempo_seg! <= c.tiempo_objetivo_seg)
  const r = rachas(h)
  const L = (icono: string, nombre: string, detalle: string, actual: number, meta: number, color: string): Logro => ({
    icono, nombre, detalle, actual: Math.min(actual, meta), meta, logrado: actual >= meta, color,
  })
  return {
    racha: r,
    km,
    n,
    logros: [
      L('👟', 'Primer paso', 'Registraste tu primera sesión', n, 1, '#1446B8'),
      L('🔟', 'Constancia', '10 sesiones registradas', n, 10, '#0F6E78'),
      L('💯', 'Centenario', '100 sesiones registradas', n, 100, '#B3261E'),
      L('📏', '100 km', 'Sumaste 100 km', km, 100, '#2E7D4F'),
      L('🚀', '500 km', 'Sumaste 500 km', km, 500, '#6B4E8C'),
      L('🌎', '1.000 km', 'Sumaste 1.000 km', km, 1000, '#0F6E78'),
      L('🔥', 'Racha de 4', '4 semanas seguidas cumpliendo el plan', r.mejor, 4, '#E8590C'),
      L('⚡', 'Racha de 12', '12 semanas seguidas cumpliendo el plan', r.mejor, 12, '#D9A032'),
      L('🌅', 'Fondista', 'Una sesión de 21 km o más', largo, 21, '#C2185B'),
      L('🏁', 'A la cancha', 'Corriste tu primera carrera', corridas.length, 1, '#0B1B3A'),
      L('🎯', 'Objetivo cumplido', 'Bajaste tu tiempo objetivo en una carrera', objetivo ? 1 : 0, 1, '#B3261E'),
      L('📍', 'Presente', '10 entrenamientos grupales', h.asistencias.length, 10, '#1446B8'),
    ],
  }
}

function useHistorial(alumnoId: string) {
  const [h, setH] = useState<Historial | null>(historialEnMemoria(alumnoId) ?? null)
  useEffect(() => {
    cargarHistorial(alumnoId).then(setH)
  }, [alumnoId])
  return h
}
export { useHistorial }

/** Rachas y logros: a todo color los conseguidos, en gris con progreso los pendientes. */
export function Logros({ alumnoId, nombre }: { alumnoId: string; nombre?: string }) {
  const h = useHistorial(alumnoId)
  if (!h) return <Cargando />
  const { racha, logros, km, n } = calcularLogros(h)
  const conseguidos = logros.filter((l) => l.logrado).length

  return (
    <Tarjeta>
      <Titulo>🏅 Rachas y logros</Titulo>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className={`rounded-xl p-2 ${racha.actual > 0 ? 'bg-linear-to-br from-orange-500 to-red-600 text-white' : 'bg-fondo'}`}>
          <p className="font-titulo text-2xl font-extrabold">🔥 {racha.actual}</p>
          <p className={`text-xs ${racha.actual > 0 ? 'text-white/90' : 'text-texto-2'}`}>semanas seguidas</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-azul to-marino p-2 text-white">
          <p className="font-titulo text-2xl font-extrabold">{n}</p>
          <p className="text-xs text-white/85">sesiones</p>
        </div>
        <div className="rounded-xl bg-linear-to-br from-[#0F6E78] to-[#0B1B3A] p-2 text-white">
          <p className="font-titulo text-2xl font-extrabold">{formatoKm(km)}</p>
          <p className="text-xs text-white/85">km totales</p>
        </div>
      </div>
      {racha.mejor > racha.actual && <p className="mb-2 text-sm text-texto-2">Tu mejor racha: {racha.mejor} semanas.</p>}
      <p className="mb-2 text-sm font-semibold">
        {conseguidos} de {logros.length} logros
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {logros.map((l) => (
          <li
            key={l.nombre}
            title={l.detalle}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl border-2 p-2 text-center ${l.logrado ? 'shadow-sm' : 'border-borde bg-fondo'}`}
            style={l.logrado ? { borderColor: l.color, background: `linear-gradient(160deg, ${l.color}33, ${l.color}0D)` } : undefined}
          >
            {l.logrado && (
              <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: l.color }} aria-hidden="true">
                ✓
              </span>
            )}
            <span className={`text-3xl ${l.logrado ? '' : 'opacity-35 grayscale'}`} aria-hidden="true">
              {l.icono}
            </span>
            <span className={`text-xs font-bold leading-tight ${l.logrado ? '' : 'text-texto-2'}`} style={l.logrado ? { color: l.color } : undefined}>
              {l.nombre}
            </span>
            {l.logrado ? (
              <span className="text-[0.65rem] font-semibold leading-tight text-texto-2">¡Logrado!</span>
            ) : (
              <span className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-borde" aria-label={`${Math.round((100 * l.actual) / l.meta)}%`}>
                <span className="block h-full rounded-full bg-texto-2/60" style={{ width: `${(100 * l.actual) / l.meta}%` }} />
              </span>
            )}
            <span className="sr-only">{l.detalle}</span>
          </li>
        ))}
      </ul>
      {nombre && conseguidos > 0 && (
        <div className="mt-3">
          <BotonCompartir
            className="w-full"
            nombreArchivo="rivero-logros.png"
            etiqueta="📤 Compartir mi último logro"
            generar={(estilo) => {
              const ultimo = [...logros].reverse().find((l) => l.logrado)!
              return tarjetaLogro({
                estilo,
                nombre,
                icono: ultimo.icono,
                titulo: ultimo.nombre,
                detalle: ultimo.detalle,
                fecha: formatoFecha(hoyPY()),
                color: ultimo.color,
                datos: [
                  { etiqueta: 'Sesiones', valor: String(n) },
                  { etiqueta: 'Km totales', valor: formatoKm(km) },
                  { etiqueta: 'Logros', valor: `${conseguidos}/${logros.length}` },
                ],
              })
            }}
          />
        </div>
      )}
    </Tarjeta>
  )
}
