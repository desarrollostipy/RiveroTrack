import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { calcularRecords, calcularRetos, resumenMeses, type Historial, type Reto } from '../lib/historial'
import { hoyPY, nombreMes, primerDiaMes, sumarDias } from '../lib/fechas'
import { formatoFecha, formatoKm, formatoRitmo } from '../lib/formato'
import { tarjetaLista } from '../lib/tarjetas'
import { BotonCompartir } from './Compartir'
import { Tarjeta, Titulo, Vacio } from './ui'

/** 🏆 Mis récords: lo mejor de cada categoría, con fecha. */
export function Records({ h, nombre }: { h: Historial; nombre?: string }) {
  const records = calcularRecords(h)
  // Récord nuevo: logrado en las últimas 2 semanas.
  const hace14 = sumarDias(hoyPY(), -14)
  const esNuevo = (fecha: string | null) => !!fecha && fecha >= hace14
  const vitrina = records.filter((r) => r.clave.startsWith('marca-') || r.clave.startsWith('pista-'))
  const resto = records.filter((r) => !vitrina.includes(r))
  return (
    <section className="flex flex-col gap-3">
      <div className="tarjeta-heroe rounded-3xl p-4 text-[#1B1300]" style={{ background: 'linear-gradient(135deg, #FFE08A, #F2A81D 60%, #C97A06)' }}>
        <p className="font-titulo text-2xl font-black">🏆 Mi vitrina</p>
        <p className="text-sm font-semibold opacity-80">Mis mejores marcas y lo mejor de cada categoría</p>
      </div>
      {records.length === 0 && <Vacio>Tus récords van a aparecer acá cuando registres tus primeras sesiones.</Vacio>}
      {vitrina.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {vitrina.map((r, i) => {
            const nuevo = esNuevo(r.fecha)
            return (
              <li
                key={r.clave}
                className={`relative flex animate-pop flex-col items-center gap-0.5 rounded-3xl border p-3 text-center ${
                  nuevo ? 'border-volt shadow-[0_0_24px_-4px_rgba(200,255,61,0.55)]' : 'border-[#F2B544]/40'
                }`}
                style={{ background: 'linear-gradient(170deg, rgba(242,181,68,0.22), rgba(242,181,68,0.03))', animationDelay: `${i * 0.06}s` }}
              >
                {nuevo && <span className="boton-accion absolute -top-2 right-2 rounded-full px-2 text-[0.65rem] font-black uppercase">¡Nuevo!</span>}
                <span className="text-3xl drop-shadow" aria-hidden="true">
                  {r.clave.startsWith('pista-') ? '🏟️' : '🥇'}
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-texto-2">{r.titulo.replace('Marca ', '')}</span>
                <span className="font-titulo text-2xl font-black tracking-tight text-tinta">{r.valor}</span>
                <span className="w-full truncate text-[0.7rem] text-texto-2">
                  {r.detalle}
                  {r.fecha ? ` · ${formatoFecha(r.fecha)}` : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {resto.map((r) => (
          <li
            key={r.clave}
            className={`relative flex flex-col gap-0.5 rounded-3xl border bg-superficie p-3 ${esNuevo(r.fecha) ? 'border-volt shadow-[0_0_20px_-6px_rgba(200,255,61,0.5)]' : 'border-borde'}`}
          >
            {esNuevo(r.fecha) && <span className="boton-accion absolute -top-2 right-2 rounded-full px-2 text-[0.65rem] font-black uppercase">¡Nuevo!</span>}
            <span className="text-2xl" aria-hidden="true">
              {r.icono}
            </span>
            <span className="text-xs font-semibold text-texto-2">{r.titulo}</span>
            <span className="font-mono text-xl font-semibold text-tinta">{r.valor}</span>
            <span className="truncate text-xs text-texto-2">
              {r.detalle}
              {r.fecha ? ` · ${formatoFecha(r.fecha)}` : ''}
            </span>
          </li>
        ))}
      </ul>
      {nombre && records.length > 0 && (
        <BotonCompartir
          variante="primario"
          className="w-full"
          nombreArchivo="rivero-mis-records.png"
          etiqueta="📤 Compartir mis récords"
          generar={(estilo) => {
            const meses = resumenMeses(h)
            return tarjetaLista({
              estilo,
              nombre,
              titulo: 'Mis récords',
              subtitulo: formatoFecha(hoyPY()),
              destacado: `${formatoKm(meses.reduce((t, m) => t + m.km, 0))} km en 6 meses`,
              grafico: {
                titulo: 'Km por mes',
                barras: meses.map((m, i) => ({ etiqueta: m.mes, valor: m.km, texto: m.km ? String(Math.round(m.km)) : '', destacada: i === meses.length - 1 })),
              },
              mosaico: true,
              filas: records.map((r) => ({ icono: r.icono, texto: r.titulo, valor: r.valor })),
            })
          }}
        />
      )}
    </section>
  )
}

function BarraReto({ r }: { r: Reto }) {
  const pct = r.meta ? Math.min(100, (100 * r.actual) / r.meta) : 0
  return (
    <li className={`rounded-2xl border-2 p-3 ${r.cumplido ? 'border-ok bg-linear-to-br from-ok/20 to-ok/5' : 'border-borde bg-superficie'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <span className={`text-2xl ${r.cumplido ? '' : 'opacity-70'}`} aria-hidden="true">
            {r.icono}
          </span>
          <span>
            <span className="block font-semibold">{r.titulo}</span>
            <span className="text-xs text-texto-2">{r.detalle}</span>
          </span>
        </span>
        <span className={`shrink-0 font-mono text-sm font-semibold ${r.cumplido ? 'text-ok' : ''}`}>
          {r.cumplido ? '✓ ¡Cumplido!' : `${formatoKm(r.actual)}/${formatoKm(r.meta)}`}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-borde" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${r.cumplido ? 'bg-ok' : 'bg-azul'}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  )
}

/** 🎯 Retos de la semana y del mes. */
export function Retos({ h, nombre }: { h: Historial; nombre?: string }) {
  const { semana, mes } = calcularRetos(h)
  const todos = [...semana, ...mes]
  const cumplidos = todos.filter((r) => r.cumplido)
  return (
    <Tarjeta>
      <Titulo>🎯 Retos</Titulo>
      {semana.length > 0 && (
        <>
          <p className="mb-1.5 text-sm font-semibold text-texto-2">Esta semana</p>
          <ul className="mb-3 flex flex-col gap-2">
            {semana.map((r) => (
              <BarraReto key={r.clave} r={r} />
            ))}
          </ul>
        </>
      )}
      <p className="mb-1.5 text-sm font-semibold text-texto-2">{nombreMes(primerDiaMes(hoyPY()))}</p>
      <ul className="flex flex-col gap-2">
        {mes.map((r) => (
          <BarraReto key={r.clave} r={r} />
        ))}
      </ul>
      {nombre && (
        <BotonCompartir
          className="mt-3 w-full"
          nombreArchivo="rivero-retos.png"
          etiqueta="📤 Compartir mis retos"
          generar={(estilo) =>
            tarjetaLista({
              estilo,
              nombre,
              titulo: 'Mis retos',
              subtitulo: `${nombreMes(primerDiaMes(hoyPY()))} ${hoyPY().slice(0, 4)}`,
              destacado: `${cumplidos.length} de ${todos.length} cumplidos 💪`,
              filas: todos.map((r) => ({
                icono: r.icono,
                texto: r.titulo,
                valor: r.cumplido ? '✓' : `${formatoKm(r.actual)}/${formatoKm(r.meta)}`,
                progreso: r.meta ? r.actual / r.meta : 0,
                cumplido: r.cumplido,
              })),
            })
          }
        />
      )}
    </Tarjeta>
  )
}

/** 📈 Comparar: km y sesiones por mes, y el ritmo promedio. */
export function Comparar({ h }: { h: Historial }) {
  const meses = resumenMeses(h)
  const [ant, act] = meses.slice(-2)
  const dif = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : null)
  const dKm = dif(act.km, ant.km)
  const conRitmo = meses.filter((m) => m.ritmo)
  return (
    <Tarjeta>
      <Titulo>📈 Este mes vs. el anterior</Titulo>
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-fondo p-2">
          <p className="font-titulo text-xl font-extrabold">{formatoKm(act.km)}</p>
          <p className="text-xs text-texto-2">km ({formatoKm(ant.km)} antes)</p>
          {dKm !== null && <p className={`text-xs font-bold ${dKm >= 0 ? 'text-ok' : 'text-mal'}`}>{dKm >= 0 ? '▲' : '▼'} {Math.abs(dKm)}%</p>}
        </div>
        <div className="rounded-xl bg-fondo p-2">
          <p className="font-titulo text-xl font-extrabold">{act.sesiones}</p>
          <p className="text-xs text-texto-2">sesiones ({ant.sesiones} antes)</p>
        </div>
        <div className="rounded-xl bg-fondo p-2">
          <p className="font-titulo text-xl font-extrabold">{act.ritmo ? formatoRitmo(act.ritmo) : '—'}</p>
          <p className="text-xs text-texto-2">ritmo ({ant.ritmo ? formatoRitmo(ant.ritmo) : '—'} antes)</p>
          {act.ritmo && ant.ritmo ? (
            <p className={`text-xs font-bold ${act.ritmo <= ant.ritmo ? 'text-ok' : 'text-mal'}`}>
              {act.ritmo <= ant.ritmo ? '▲ más rápido' : '▼ más lento'}
            </p>
          ) : null}
        </div>
      </div>
      <div className="h-52" role="img" aria-label="Kilómetros y sesiones de los últimos 6 meses">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={meses} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--color-borde)" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="km" name="Km" fill="var(--color-azul)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="sesiones" name="Sesiones" fill="#7EA6FF" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {conRitmo.length >= 2 && (
        <>
          <p className="mb-1 mt-3 text-sm font-semibold">Ritmo promedio por mes</p>
          <div className="h-40" role="img" aria-label="Ritmo promedio por mes">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={meses} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--color-borde)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
                <YAxis reversed domain={['dataMin - 10', 'dataMax + 10']} tickFormatter={(v) => formatoRitmo(v)} tick={{ fontSize: 11, fill: 'var(--color-texto-2)' }} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => `${formatoRitmo(Number(v))}/km`} />
                <Line type="monotone" dataKey="ritmo" name="Ritmo" stroke="#0F6E78" strokeWidth={3} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-texto-2">Más arriba = más rápido.</p>
        </>
      )}
    </Tarjeta>
  )
}
