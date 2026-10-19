import { useCallback, useEffect, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { mensajeError } from '../../lib/consultas'
import { hoyPY, lunesDe, sumarDias } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoPeso, formatoRitmo, leerNumero } from '../../lib/formato'
import type { Marca, Medicion, Resultado } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { cargarEvolucion, GraficoKm, indicadores } from '../../components/EvolucionAlumno'
import { Boton, Campo, Cargando, Indicador, MensajeError, Tarjeta, Titulo, Vacio } from '../../components/ui'

export default function Progreso() {
  const { alumno } = useMiAlumno()
  const [evo, setEvo] = useState<Awaited<ReturnType<typeof cargarEvolucion>> | null>(null)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [marcas, setMarcas] = useState<Marca[]>([])

  useEffect(() => {
    const hoy = hoyPY()
    cargarEvolucion(alumno.id).then(setEvo)
    supabase
      .from('evaluaciones')
      .select('resultado, sesiones_planificadas!inner(fecha)')
      .gte('sesiones_planificadas.fecha', sumarDias(lunesDe(hoy), -49))
      .then(({ data }) => setResultados(((data ?? []) as { resultado: Resultado }[]).map((e) => e.resultado)))
    supabase
      .from('marcas_personales')
      .select('*')
      .eq('alumno_id', alumno.id)
      .then(({ data }) => setMarcas((data ?? []) as Marca[]))
  }, [alumno.id])

  const ind = evo ? indicadores(evo.semanas, evo.fondos, evo.lunes) : null
  const total = resultados.length
  const cuenta = (r: Resultado) => resultados.filter((x) => x === r).length

  return (
    <Pantalla titulo="Progreso">
      <PesoAltura />

      {!evo || !ind ? (
        <Cargando />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Indicador valor={`${formatoKm(ind.kmTotal)} km`} texto="en las últimas 8 semanas" tono="azul" />
            {ind.actual ? (
              <Indicador
                valor={`${formatoRitmo(ind.actual)}/km`}
                texto={ind.anterior ? `ritmo en fondos (antes ${formatoRitmo(ind.anterior)})` : 'ritmo actual en fondos'}
                tono={ind.variacion !== null && ind.variacion < 0 ? 'ok' : 'normal'}
              />
            ) : (
              // Sin fondos registrados todavía: ritmo promedio de todas las sesiones.
              <Indicador valor={ind.ritmoGeneral ? `${formatoRitmo(ind.ritmoGeneral)}/km` : '—'} texto="ritmo promedio (todas las sesiones)" />
            )}
          </div>
          <Tarjeta>
            <Titulo>Km por semana</Titulo>
            {evo.semanas.length ? <GraficoKm semanas={evo.semanas} lunes={evo.lunes} /> : <p className="text-sm text-texto-2">Todavía no hay semanas.</p>}
          </Tarjeta>
        </>
      )}

      <Tarjeta>
        <Titulo>Cumplimiento (8 semanas)</Titulo>
        {total === 0 ? (
          <p className="text-sm text-texto-2">Todavía no hay sesiones evaluadas.</p>
        ) : (
          <>
            <div className="flex h-5 overflow-hidden rounded-full" role="img" aria-label={`Cumplió ${cuenta('cumplio')}, parcial ${cuenta('parcial')}, no cumplió ${cuenta('no_cumplio')}`}>
              <div className="bg-ok" style={{ width: `${(100 * cuenta('cumplio')) / total}%` }} />
              <div className="bg-parcial" style={{ width: `${(100 * cuenta('parcial')) / total}%` }} />
              <div className="bg-mal" style={{ width: `${(100 * cuenta('no_cumplio')) / total}%` }} />
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 text-sm">
              <li className="text-ok">● Cumplió {cuenta('cumplio')}</li>
              <li className="text-marino">● Parcial {cuenta('parcial')}</li>
              <li className="text-mal">● No cumplió {cuenta('no_cumplio')}</li>
            </ul>
          </>
        )}
      </Tarjeta>

      <Tarjeta>
        <Titulo>Marcas personales</Titulo>
        {marcas.length === 0 ? (
          <p className="text-sm text-texto-2">Tu entrenador todavía no cargó marcas.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {marcas.map((m) => (
              <li key={m.id} className="flex justify-between py-1.5">
                <span className="font-semibold">{m.distancia}</span>
                <span className="font-mono">{formatoDuracion(m.tiempo_seg)}</span>
                <span className="text-sm text-texto-2">{m.carrera ?? ''}</span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </Pantalla>
  )
}

function PesoAltura() {
  const { alumno, recargar } = useMiAlumno()
  const hoy = hoyPY()
  const [pesos, setPesos] = useState<Medicion[] | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [peso, setPeso] = useState('')
  const [altura, setAltura] = useState(alumno.altura_cm ? String(alumno.altura_cm) : '')
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('mediciones').select('*').eq('alumno_id', alumno.id).gte('fecha', sumarDias(hoy, -84)).order('fecha')
    setPesos((data ?? []) as Medicion[])
  }, [alumno.id, hoy])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function guardar() {
    setError('')
    const kg = leerNumero(peso)
    if (!kg || kg < 25 || kg > 250) return setError('Ingresá un peso válido, por ejemplo 68,5.')
    const { error } = await supabase.from('mediciones').insert({ alumno_id: alumno.id, fecha: hoy, peso_kg: Math.round(kg * 10) / 10 })
    if (error) return setError(mensajeError(error))
    const alt = leerNumero(altura)
    if (alt && alt !== alumno.altura_cm) {
      if (alt < 100 || alt > 230) return setError('La altura va de 100 a 230 cm.')
      await supabase.rpc('set_mi_altura', { p_altura_cm: alt })
      recargar()
    }
    setPeso('')
    setAbierto(false)
    cargar()
  }

  const ultimo = pesos?.[pesos.length - 1]

  return (
    <Tarjeta>
      <Titulo>Peso y altura</Titulo>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-texto-2">Peso actual {ultimo ? `(${formatoFecha(ultimo.fecha)})` : ''}</p>
          <p className="font-mono text-xl font-semibold">{ultimo ? `${formatoPeso(ultimo.peso_kg)} kg` : '—'}</p>
        </div>
        <div>
          <p className="text-xs text-texto-2">Altura</p>
          <p className="font-mono text-xl font-semibold">{alumno.altura_cm ? `${alumno.altura_cm} cm` : '—'}</p>
        </div>
      </div>
      {pesos && pesos.length >= 2 && (
        <div className="mt-2 h-24" role="img" aria-label="Evolución del peso">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={pesos.map((p) => ({ fecha: formatoFecha(p.fecha), kg: Number(p.peso_kg) }))} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#56617A' }} tickLine={false} axisLine={false} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tick={{ fontSize: 10, fill: '#56617A' }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(v) => `${formatoPeso(Number(v))} kg`} />
              <Line type="monotone" dataKey="kg" stroke="#1446B8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      {pesos?.length === 0 && <Vacio>Todavía no registraste tu peso.</Vacio>}
      {abierto ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <Campo id="mi-peso" label="Peso de hoy (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} />
            <Campo id="mi-altura" label="Altura (cm)" inputMode="numeric" value={altura} onChange={(e) => setAltura(e.target.value.replace(/\D/g, ''))} />
          </div>
          <MensajeError>{error}</MensajeError>
          <Boton onClick={guardar}>Guardar</Boton>
        </div>
      ) : (
        <Boton variante="borde" className="mt-3 w-full" onClick={() => setAbierto(true)}>
          Registrar peso de hoy
        </Boton>
      )}
    </Tarjeta>
  )
}
