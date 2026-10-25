import { DIAS_CORTOS, hoyPY, sumarDias } from '../lib/fechas'
import { formatoKcal, useEnergia, type DatosCuerpo } from '../lib/calorias'
import { miles } from '../lib/formato'
import { Tarjeta, Titulo } from './ui'

const AVISO = 'Estimado con tu peso, el tiempo y el pulso (o lo que marcó tu reloj). Es una referencia, no un dato médico.'

function NotaPeso({ cuerpo, deOtro }: { cuerpo: DatosCuerpo; deOtro?: boolean }) {
  if (cuerpo.pesoReal) return null
  return <p className="mt-1 text-xs text-[#9A6B00]">⚖️ {deOtro ? 'Sin peso cargado: se usa un peso promedio. Cargalo en Datos físicos.' : 'Sin tu peso cargado se usa un promedio. Cargalo en Progreso → Peso y altura.'}</p>
}

/** Calorías quemadas hoy en entrenamientos y gasto total estimado del día. */
export function EnergiaHoy({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const datos = useEnergia(alumnoId, hoy, hoy)
  if (!datos) return null
  const d = datos.dias[0]
  if (!d.entrenamiento && !d.reposo) return null
  return (
    <Tarjeta>
      <Titulo>🔥 Energía de hoy</Titulo>
      {d.entrenamiento ? (
        <>
          <p>
            <span className="font-titulo text-3xl font-extrabold text-[#C2410C]">{miles(d.entrenamiento)}</span> <span className="font-semibold">kcal en entrenamientos</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {d.partes.map((p, i) => (
              <span key={i} className="rounded-full bg-fondo px-2.5 py-0.5 text-xs font-semibold">
                {p.texto} · {formatoKcal(p.kcal)}
                {p.delReloj ? ' ⌚' : ''}
              </span>
            ))}
          </div>
        </>
      ) : (
        <p className="text-texto-2">Todavía no registraste entrenamientos hoy.</p>
      )}
      {d.reposo && (
        <p className="mt-2 text-sm">
          Gasto total estimado del día: <b className="font-mono">≈ {formatoKcal(d.reposo + d.entrenamiento)}</b>
          <span className="text-texto-2"> ({miles(d.reposo)} del día a día + {miles(d.entrenamiento)} entrenando)</span>
        </p>
      )}
      <NotaPeso cuerpo={datos.cuerpo} />
      <p className="mt-1 text-xs text-texto-2">{AVISO}</p>
    </Tarjeta>
  )
}

/** Calorías de entrenamiento por día de una semana, con el total. */
export function EnergiaSemana({ alumnoId, lunes, deOtro = false }: { alumnoId: string; lunes: string; deOtro?: boolean }) {
  const datos = useEnergia(alumnoId, lunes, sumarDias(lunes, 6))
  if (!datos) return null
  const total = datos.dias.reduce((t, d) => t + d.entrenamiento, 0)
  if (!total) return null
  const max = Math.max(...datos.dias.map((d) => d.entrenamiento))
  const conEntreno = datos.dias.filter((d) => d.entrenamiento > 0).length
  const reposo = datos.dias[0].reposo
  const hoy = hoyPY()
  // El promedio diario cuenta solo los días que ya pasaron (en la semana actual).
  const transcurridos = datos.dias.filter((d) => d.fecha <= hoy).length || 7
  return (
    <Tarjeta>
      <Titulo>🔥 Calorías de la semana</Titulo>
      <p>
        <span className="font-titulo text-2xl font-extrabold text-[#C2410C]">{miles(total)}</span> <span className="font-semibold">kcal entrenando</span>
        <span className="text-sm text-texto-2"> · {miles(total / conEntreno)} por día de entrenamiento</span>
      </p>
      <div className="mt-3 grid h-28 grid-cols-7 gap-1.5" aria-label="Calorías por día">
        {datos.dias.map((d, i) => (
          <div key={d.fecha} className="flex flex-col items-center justify-end gap-1" title={d.partes.map((p) => `${p.texto}: ${formatoKcal(p.kcal)}`).join(' · ')}>
            <span className="text-[0.65rem] font-semibold text-texto-2">{d.entrenamiento ? miles(d.entrenamiento) : ''}</span>
            <span
              className={`w-full max-w-8 rounded-t-md ${d.fecha === hoy ? 'bg-[#C2410C]' : 'bg-[#F59E0B]'}`}
              style={{ height: d.entrenamiento ? `${Math.max(6, (d.entrenamiento / max) * 64)}px` : '3px', opacity: d.entrenamiento ? 1 : 0.3 }}
            />
            <span className={`text-xs ${d.fecha === hoy ? 'font-bold' : 'text-texto-2'}`}>{DIAS_CORTOS[i]}</span>
          </div>
        ))}
      </div>
      {reposo && (
        <p className="mt-2 text-sm">
          Gasto total estimado: <b className="font-mono">≈ {formatoKcal(total / transcurridos + reposo)}</b> por día en promedio
        </p>
      )}
      <NotaPeso cuerpo={datos.cuerpo} deOtro={deOtro} />
      <p className="mt-1 text-xs text-texto-2">{AVISO.replace('tu peso', deOtro ? 'su peso' : 'tu peso').replace('tu reloj', deOtro ? 'su reloj' : 'tu reloj')}</p>
    </Tarjeta>
  )
}
