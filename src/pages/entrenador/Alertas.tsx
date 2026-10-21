import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { cargarAlertas, type Alerta, type Carga } from '../../lib/alertas'
import { formatoKm } from '../../lib/formato'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Cargando, Tarjeta, Titulo, Vacio } from '../../components/ui'

const COLOR_SEMAFORO = { rojo: 'bg-mal', amarillo: 'bg-parcial', verde: 'bg-ok', gris: 'bg-borde' } as const

function FilaAlerta({ a }: { a: Alerta }) {
  return (
    <li>
      <Link
        to={`/alumnos/${a.alumnoId}?tab=${a.tab}`}
        className={`flex items-start gap-3 rounded-2xl border-l-4 bg-superficie p-3 hover:bg-fondo ${a.nivel === 'rojo' ? 'border-mal' : 'border-parcial'}`}
      >
        <span className="text-2xl" aria-hidden="true">
          {a.icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-texto-2">{a.nombre}</span>
          <span className="block font-semibold">{a.titulo}</span>
          <span className="block text-sm text-texto-2">{a.detalle}</span>
        </span>
        <span className="self-center text-texto-2" aria-hidden="true">
          ›
        </span>
      </Link>
    </li>
  )
}

/** Mini gráfico de las últimas 5 semanas (la última, destacada). */
function MiniKm({ km, color }: { km: number[]; color: keyof typeof COLOR_SEMAFORO }) {
  const max = Math.max(...km, 1)
  return (
    <span className="flex h-8 items-end gap-0.5" aria-hidden="true">
      {km.map((k, i) => (
        <span key={i} className={`w-2 rounded-sm ${i === km.length - 1 ? COLOR_SEMAFORO[color] : 'bg-borde'}`} style={{ height: `${Math.max(8, (k / max) * 100)}%` }} />
      ))}
    </span>
  )
}

export default function Alertas() {
  const [datos, setDatos] = useState<{ alertas: Alerta[]; cargas: Carga[] } | null>(null)
  const [verCarga, setVerCarga] = useState<'todos' | 'atencion'>('atencion')

  useEffect(() => {
    cargarAlertas(true).then(setDatos)
  }, [])

  if (!datos) return <Cargando pantalla />
  const rojas = datos.alertas.filter((a) => a.nivel === 'rojo')
  const amarillas = datos.alertas.filter((a) => a.nivel === 'amarillo')
  const orden = { rojo: 0, amarillo: 1, verde: 2, gris: 3 }
  const cargas = [...datos.cargas]
    .sort((a, b) => orden[a.semaforo.color] - orden[b.semaforo.color] || a.nombre.localeCompare(b.nombre))
    .filter((c) => verCarga === 'todos' || c.semaforo.color === 'rojo' || c.semaforo.color === 'amarillo')

  return (
    <Pantalla titulo="Alertas" subtitulo="Quién necesita atención" volver="/alumnos">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-mal/10 p-3 text-center">
          <p className="font-titulo text-3xl font-extrabold text-mal">{rojas.length}</p>
          <p className="text-sm font-semibold">Atender hoy</p>
        </div>
        <div className="rounded-2xl bg-parcial/20 p-3 text-center">
          <p className="font-titulo text-3xl font-extrabold">{amarillas.length}</p>
          <p className="text-sm font-semibold">Para mirar</p>
        </div>
      </div>

      {datos.alertas.length === 0 && <Vacio>Todo en orden 🙌 No hay alertas.</Vacio>}
      {rojas.length > 0 && (
        <section>
          <h2 className="mb-2 font-titulo text-lg font-bold">🔴 Atender hoy</h2>
          <ul className="flex flex-col gap-2">
            {rojas.map((a, i) => (
              <FilaAlerta key={i} a={a} />
            ))}
          </ul>
        </section>
      )}
      {amarillas.length > 0 && (
        <section>
          <h2 className="mb-2 font-titulo text-lg font-bold">🟡 Para mirar</h2>
          <ul className="flex flex-col gap-2">
            {amarillas.map((a, i) => (
              <FilaAlerta key={i} a={a} />
            ))}
          </ul>
        </section>
      )}

      <Tarjeta>
        <Titulo
          accion={
            <Boton variante="texto" onClick={() => setVerCarga(verCarga === 'todos' ? 'atencion' : 'todos')}>
              {verCarga === 'todos' ? 'Solo atención' : 'Ver todos'}
            </Boton>
          }
        >
          🚦 Semáforo de carga
        </Titulo>
        <p className="-mt-1 mb-3 text-sm text-texto-2">
          Km de la semana pasada contra el promedio de las 4 anteriores. Subir más de 30% de golpe aumenta el riesgo de lesión.
        </p>
        {cargas.length === 0 ? (
          <Vacio>Nadie con cambios bruscos de carga 👍</Vacio>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {cargas.map((c) => (
              <li key={c.alumnoId}>
                <Link to={`/alumnos/${c.alumnoId}?tab=evolucion`} className="flex items-center gap-3 py-2">
                  <span className={`h-3.5 w-3.5 shrink-0 rounded-full ${COLOR_SEMAFORO[c.semaforo.color]}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{c.nombre}</span>
                    <span className="block text-xs text-texto-2">
                      {c.semaforo.texto} · {formatoKm(c.semaforo.ultima)} km
                    </span>
                  </span>
                  <MiniKm km={c.kmSemanas} color={c.semaforo.color} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </Pantalla>
  )
}
