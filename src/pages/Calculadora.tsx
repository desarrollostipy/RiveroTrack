import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSesion } from '../lib/sesion'
import { formatoDuracion, formatoKm, formatoRitmo, leerDuracion, leerNumero } from '../lib/formato'
import { Pantalla } from '../components/Pantalla'
import { Campo, Opciones, Tarjeta, Titulo } from '../components/ui'

// Calculadora de ritmos: con una marca (por ejemplo 10K en 50:00) estima los
// tiempos en otras distancias (fórmula de Riegel) y sugiere ritmos de entrenamiento.
// Son orientativos: el entrenador decide.

const DISTANCIAS = [
  { valor: '5', texto: '5K', km: 5 },
  { valor: '10', texto: '10K', km: 10 },
  { valor: '21.1', texto: '21K', km: 21.0975 },
  { valor: '42.2', texto: '42K', km: 42.195 },
]

const riegel = (t1: number, d1: number, d2: number) => t1 * Math.pow(d2 / d1, 1.06)

export default function Calculadora() {
  const { perfil } = useSesion()
  const [dist, setDist] = useState('10')
  const [otra, setOtra] = useState('')
  const [tiempo, setTiempo] = useState('')
  const [objetivoDist, setObjetivoDist] = useState('21.1')
  const [precargada, setPrecargada] = useState('')

  // Alumno: arranca con su mejor marca de 10K (o 5K).
  useEffect(() => {
    if (perfil?.rol !== 'alumno') return
    supabase
      .from('marcas_personales')
      .select('distancia, tiempo_seg')
      .in('distancia', ['10K', '5K', '21K'])
      .order('tiempo_seg')
      .then(({ data }) => {
        const marcas = (data ?? []) as { distancia: string; tiempo_seg: number }[]
        const m = marcas.find((x) => x.distancia === '10K') ?? marcas.find((x) => x.distancia === '5K') ?? marcas[0]
        if (!m) return
        setDist(m.distancia === '5K' ? '5' : m.distancia === '21K' ? '21.1' : '10')
        setTiempo(formatoDuracion(m.tiempo_seg))
        setPrecargada(`Cargamos tu marca de ${m.distancia}.`)
      })
  }, [perfil?.rol])

  const km = dist === 'otra' ? leerNumero(otra) : DISTANCIAS.find((d) => d.valor === dist)!.km
  const seg = leerDuracion(tiempo)

  const r = useMemo(() => {
    if (!km || !seg || km <= 0 || seg <= 0) return null
    const t10 = riegel(seg, km, 10)
    const p10 = t10 / 10 // ritmo de 10K en s/km
    const p5 = riegel(seg, km, 5) / 5
    const p21 = riegel(seg, km, 21.0975) / 21.0975
    return {
      predicciones: DISTANCIAS.map((d) => ({ ...d, t: riegel(seg, km, d.km), ritmo: riegel(seg, km, d.km) / d.km })),
      zonas: [
        { nombre: 'Rodaje suave', desc: 'Conversando, recuperación', min: p10 + 60, max: p10 + 80 },
        { nombre: 'Fondo', desc: 'Largos, ritmo cómodo', min: p10 + 40, max: p10 + 60 },
        { nombre: 'Ritmo 21K', desc: 'Específico de media maratón', min: p21 - 3, max: p21 + 3 },
        { nombre: 'Umbral / tempo', desc: 'Exigente pero sostenido', min: p10 + 5, max: p10 + 15 },
        { nombre: 'Series 1000', desc: 'Ritmo de 5K', min: p5 - 3, max: p5 + 3 },
        { nombre: 'Pista 400', desc: 'Más rápido que 5K', min: p5 - 18, max: p5 - 10 },
      ],
    }
  }, [km, seg])

  const objetivo = r?.predicciones.find((p) => p.valor === objetivoDist)
  const parciales = objetivo
    ? Array.from({ length: Math.ceil(objetivo.km) }, (_, i) => {
        const k = Math.min(i + 1, objetivo.km)
        return { km: k, t: objetivo.ritmo * k }
      }).filter((_, i, arr) => arr.length <= 12 || (i + 1) % 5 === 0 || i === arr.length - 1)
    : []

  return (
    <Pantalla titulo="Calculadora de ritmos" subtitulo="Tiempos estimados y ritmos sugeridos" volver={perfil?.rol === 'entrenador' ? '/herramientas' : '/progreso'}>
      <Tarjeta className="flex flex-col gap-3">
        <Titulo>Tu referencia</Titulo>
        {precargada && <p className="-mt-2 text-sm text-texto-2">{precargada}</p>}
        <Opciones
          label="Distancia de una carrera reciente"
          valor={dist}
          onChange={setDist}
          opciones={[...DISTANCIAS.map((d) => ({ valor: d.valor, texto: d.texto })), { valor: 'otra', texto: 'Otra' }]}
        />
        {dist === 'otra' && <Campo id="calc-km" label="Distancia (km)" inputMode="decimal" value={otra} onChange={(e) => setOtra(e.target.value)} />}
        <Campo id="calc-tiempo" label="Tiempo" placeholder="50:00 o 1:45:30" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        {km && seg ? <p className="text-sm">Ritmo: <strong className="font-mono">{formatoRitmo(seg / km)}/km</strong></p> : null}
      </Tarjeta>

      {r && (
        <>
          <Tarjeta>
            <Titulo>Tiempos estimados</Titulo>
            <table className="w-full text-sm">
              <tbody>
                {r.predicciones.map((p) => (
                  <tr key={p.valor} className="border-t border-borde first:border-0">
                    <td className="py-2 font-semibold">{p.texto}</td>
                    <td className="font-mono">{formatoDuracion(p.t)}</td>
                    <td className="text-right font-mono text-texto-2">{formatoRitmo(p.ritmo)}/km</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-texto-2">Estimación con la fórmula de Riegel. Supone el mismo entrenamiento para cada distancia.</p>
          </Tarjeta>

          <Tarjeta>
            <Titulo>Ritmos de entrenamiento sugeridos</Titulo>
            <ul className="flex flex-col divide-y divide-borde text-sm">
              {r.zonas.map((z) => (
                <li key={z.nombre} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    <span className="block font-semibold">{z.nombre}</span>
                    <span className="text-xs text-texto-2">{z.desc}</span>
                  </span>
                  <span className="shrink-0 font-mono">
                    {formatoRitmo(z.min)}–{formatoRitmo(z.max)}/km
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-texto-2">Orientativo: seguí siempre los ritmos que te indica tu entrenador.</p>
          </Tarjeta>

          <Tarjeta className="flex flex-col gap-3">
            <Titulo>Tiempos de paso</Titulo>
            <Opciones label="Para la carrera de" valor={objetivoDist} onChange={setObjetivoDist} opciones={DISTANCIAS.map((d) => ({ valor: d.valor, texto: d.texto }))} />
            {objetivo && (
              <>
                <p className="text-sm">
                  Objetivo estimado: <strong className="font-mono">{formatoDuracion(objetivo.t)}</strong> a <strong className="font-mono">{formatoRitmo(objetivo.ritmo)}/km</strong>
                </p>
                <ul className="grid grid-cols-3 gap-1.5 text-center text-sm">
                  {parciales.map((p) => (
                    <li key={p.km} className="rounded-lg bg-fondo py-1.5">
                      <span className="block text-xs text-texto-2">km {formatoKm(p.km)}</span>
                      <span className="font-mono">{formatoDuracion(p.t)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Tarjeta>
        </>
      )}
    </Pantalla>
  )
}
