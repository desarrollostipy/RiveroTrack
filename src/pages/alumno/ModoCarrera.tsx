import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { climaCarrera, estrategiaCarrera, type Clima } from '../../lib/comunidad'
import { DIAS, diaSemana, diasEntre, hoyPY } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRitmo, leerDuracion } from '../../lib/formato'
import type { Competencia } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { Campo, Cargando, MensajeError, Tarjeta, Titulo } from '../../components/ui'

const LISTA = [
  { cuando: 'La noche anterior', items: ['Ropa y zapatillas preparadas (nada nuevo)', 'Número y alfileres', 'Reloj y celular cargados', 'Cena liviana y conocida', 'Dormir temprano'] },
  { cuando: 'La mañana de la carrera', items: ['Desayuno 2 a 3 horas antes', 'Vaselina donde roza', 'Llegar 45 minutos antes', 'Entrada en calor de 10 minutos', 'Ir al baño con tiempo'] },
]

function leerMarcas(id: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(`rivero-carrera-${id}`) ?? '[]')
  } catch {
    return []
  }
}

/** Modo carrera: cuenta regresiva, estrategia de ritmos, clima y lista para no olvidarse nada. */
export default function ModoCarrera() {
  const { id } = useParams()
  const hoy = hoyPY()
  const [c, setC] = useState<Competencia | null | undefined>(undefined)
  const [clima, setClima] = useState<Clima | null | undefined>(undefined)
  const [prueba, setPrueba] = useState('')
  const [marcas, setMarcas] = useState<string[]>(() => leerMarcas(id!))

  useEffect(() => {
    supabase
      .from('competencias')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => {
        const comp = data as Competencia | null
        setC(comp)
        if (comp) climaCarrera(comp.lugar, comp.fecha, comp.hora_largada ?? null).then(setClima)
      })
  }, [id])

  function marcar(item: string) {
    const nuevas = marcas.includes(item) ? marcas.filter((m) => m !== item) : [...marcas, item]
    setMarcas(nuevas)
    try {
      localStorage.setItem(`rivero-carrera-${id}`, JSON.stringify(nuevas))
    } catch {
      /* sin almacenamiento */
    }
  }

  if (c === undefined) return <Cargando pantalla />
  if (c === null)
    return (
      <Pantalla titulo="Modo carrera" volver="/carreras">
        <MensajeError>No se encontró la competencia.</MensajeError>
      </Pantalla>
    )

  const faltan = diasEntre(hoy, c.fecha)
  const objetivo = c.tiempo_objetivo_seg ?? leerDuracion(prueba)
  const km = c.distancia_km ? Number(c.distancia_km) : null
  const est = km && objetivo ? estrategiaCarrera(km, objetivo) : null

  return (
    <Pantalla titulo="🏁 Modo carrera" volver="/carreras">
      <div className="overflow-hidden rounded-3xl bg-linear-to-br from-[#071330] via-marino to-azul p-5 text-white shadow-lg">
        <p className="font-titulo text-2xl font-extrabold">{c.nombre}</p>
        <p className="text-white/80">
          {DIAS[diaSemana(c.fecha)]} {formatoFecha(c.fecha)}
          {c.hora_largada ? ` · largada ${c.hora_largada.slice(0, 5)}` : ''}
          {c.lugar ? ` · ${c.lugar}` : ''}
        </p>
        <div className="mt-4 flex items-end gap-6">
          <div>
            <p className="font-titulo text-6xl font-extrabold leading-none">{faltan > 0 ? faltan : faltan === 0 ? '¡HOY!' : '✓'}</p>
            {faltan > 0 && <p className="text-sm text-white/80">{faltan === 1 ? 'día · ¡es mañana!' : 'días'}</p>}
          </div>
          {km && (
            <div>
              <p className="font-titulo text-3xl font-extrabold leading-none">{formatoKm(km)} km</p>
              {objetivo && <p className="text-sm text-white/80">objetivo {formatoDuracion(objetivo)}</p>}
            </div>
          )}
        </div>
      </div>

      <Tarjeta>
        <Titulo>🧭 Estrategia de ritmos</Titulo>
        {!km ? (
          <p className="text-sm text-texto-2">Falta la distancia de la carrera. Pedile a tu entrenador que la cargue.</p>
        ) : (
          <>
            {!c.tiempo_objetivo_seg && (
              <Campo id="prueba-objetivo" label="¿En cuánto querés terminar?" placeholder="Ej.: 52:00" value={prueba} onChange={(e) => setPrueba(e.target.value)} />
            )}
            {est && (
              <>
                <p className="mb-2 mt-1 text-sm text-texto-2">
                  Ritmo promedio <b className="font-mono text-tinta">{formatoRitmo(Math.round(est.ritmo))}/km</b>. Empezá tranquilo y terminá fuerte.
                </p>
                <ul className="flex flex-col gap-2">
                  {est.tramos.map((t, i) => (
                    <li key={i} className="flex items-center gap-3 rounded-full bg-fondo py-2 pl-2 pr-4">
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-titulo font-extrabold text-white ${['bg-ok', 'bg-azul', 'bg-mal'][i]}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">
                          {t.nombre} · km {formatoKm(t.desde)}–{formatoKm(t.hasta)}
                        </span>
                        <span className="block text-xs text-texto-2">{t.consejo}</span>
                      </span>
                      <span className="shrink-0 font-mono font-bold">{formatoRitmo(Math.round(t.ritmo))}</span>
                    </li>
                  ))}
                </ul>
                <p className="mb-1 mt-3 text-sm font-semibold">Tiempos de paso</p>
                <div className="grid grid-cols-4 gap-1.5 text-center">
                  {est.parciales.map((p) => (
                    <div key={p.km} className="rounded-xl bg-fondo p-1.5">
                      <p className="text-[0.65rem] font-semibold text-texto-2">km {formatoKm(p.km)}</p>
                      <p className="font-mono text-sm font-bold">{formatoDuracion(p.seg)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Tarjeta>

      <Tarjeta>
        <Titulo>🌤️ Clima para la largada</Titulo>
        {clima === undefined ? (
          <Cargando />
        ) : clima === null ? (
          <p className="text-sm text-texto-2">{faltan > 15 ? 'El pronóstico aparece unos 15 días antes de la carrera.' : 'No se pudo obtener el pronóstico.'}</p>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['🌡️', `${clima.temp}°`, `sensación ${clima.sensacion}°`],
                ['🌧️', `${clima.lluvia}%`, 'lluvia'],
                ['💨', `${clima.viento}`, 'km/h viento'],
                ['💧', `${clima.humedad}%`, 'humedad'],
              ].map(([i, v, t]) => (
                <div key={t} className="rounded-xl bg-fondo p-2">
                  <p className="text-xl">{i}</p>
                  <p className="font-mono font-bold">{v}</p>
                  <p className="text-[0.6rem] text-texto-2">{t}</p>
                </div>
              ))}
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {clima.consejos.map((t) => (
                <li key={t}>💡 {t}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-texto-2">
              Pronóstico para {clima.lugar} a las {(c.hora_largada ?? '07:00').slice(0, 5)} · Open-Meteo
            </p>
          </>
        )}
      </Tarjeta>

      <Tarjeta>
        <Titulo>✅ Para no olvidarte nada</Titulo>
        {LISTA.map((g) => (
          <div key={g.cuando} className="mb-3 last:mb-0">
            <p className="mb-1 text-sm font-semibold text-texto-2">{g.cuando}</p>
            <ul className="flex flex-col gap-1">
              {g.items.map((it) => (
                <li key={it}>
                  <label className="flex min-h-10 items-center gap-3 rounded-xl px-2 hover:bg-fondo">
                    <input type="checkbox" className="h-5 w-5 accent-[var(--color-azul)]" checked={marcas.includes(it)} onChange={() => marcar(it)} />
                    <span className={marcas.includes(it) ? 'text-texto-2 line-through' : ''}>{it}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Tarjeta>
    </Pantalla>
  )
}
