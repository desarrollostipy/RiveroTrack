import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { cargarAlumno, mensajeError } from '../../lib/consultas'
import { estadoDeuda, estimarCiclo } from '../../lib/calculos'
import { diasEntre, edad, fechaLarga, hoyPY } from '../../lib/fechas'
import { conSigno, formatoFecha, formatoPeso, leerNumero } from '../../lib/formato'
import type { Alumno, Ciclo, Cuota, Medicion, Pago } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Campo, Cargando, MensajeError, Pestanas, Tarjeta } from '../../components/ui'
// Los gráficos pesan: se descargan solo al abrir la pestaña Evolución.
const EvolucionAlumno = lazy(() => import('../../components/EvolucionAlumno').then((m) => ({ default: m.EvolucionAlumno })))
import { TabSemana } from './ficha/TabSemana'
import { TabPagos } from './ficha/TabPagos'
import { Acceso } from './ficha/Acceso'
import { Competencias, Marcas } from './ficha/MarcasCompetencias'

type Tab = 'semana' | 'pagos' | 'evolucion'

export default function FichaAlumno() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'semana'
  const setTab = (t: Tab) => setParams((p) => ({ ...Object.fromEntries(p), tab: t }), { replace: true })
  const hoy = hoyPY()

  const [alumno, setAlumno] = useState<Alumno | null | undefined>(undefined)
  const [pesos, setPesos] = useState<Medicion[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [ciclos, setCiclos] = useState<Ciclo[]>([])
  const [versionMarcas, setVersionMarcas] = useState(0)

  const cargar = useCallback(async () => {
    const [a, m, c, p, ci] = await Promise.all([
      cargarAlumno(id!),
      supabase.from('mediciones').select('*').eq('alumno_id', id!).order('fecha'),
      supabase.from('cuotas').select('*').eq('alumno_id', id!).order('periodo', { ascending: false }),
      supabase.from('pagos').select('*').eq('alumno_id', id!).order('fecha', { ascending: false }),
      supabase.from('ciclos_menstruales').select('*').eq('alumno_id', id!).order('fecha_inicio', { ascending: false }),
    ])
    setAlumno(a)
    setPesos((m.data ?? []) as Medicion[])
    setCuotas((c.data ?? []) as Cuota[])
    setPagos((p.data ?? []) as Pago[])
    setCiclos((ci.data ?? []) as Ciclo[]) // RLS: solo llega si la alumna comparte
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (alumno === undefined) return <Cargando pantalla />
  if (alumno === null)
    return (
      <Pantalla titulo="Alumno" volver="/alumnos">
        <MensajeError>No se encontró el alumno.</MensajeError>
      </Pantalla>
    )

  const anios = edad(alumno.fecha_nacimiento, hoy)
  const deuda = estadoDeuda(cuotas, hoy)
  const ciclo = alumno.sexo === 'F' && alumno.comparte_ciclo ? estimarCiclo(ciclos.map((c) => c.fecha_inicio), hoy) : null

  return (
    <Pantalla
      titulo={alumno.nombre}
      subtitulo={[alumno.sexo === 'F' ? 'Mujer' : 'Hombre', alumno.nivel[0].toUpperCase() + alumno.nivel.slice(1), anios ? `${anios} años` : null, alumno.activo ? null : 'INACTIVO']
        .filter(Boolean)
        .join(' · ')}
      volver="/alumnos"
      derecha={
        <Link to={`/alumnos/${alumno.id}/editar`} className="flex min-h-11 items-center rounded-xl border border-borde bg-white px-4 font-semibold">
          Editar
        </Link>
      }
    >
      {alumno.objetivo && <p className="-mt-1 text-texto-2">🎯 {alumno.objetivo}</p>}

      <button
        type="button"
        onClick={() => setTab('pagos')}
        className={`min-h-11 rounded-2xl px-4 py-3 text-left ${deuda.vencidas.length ? 'bg-mal text-white' : 'bg-ok/10 text-ok'}`}
      >
        <p className="font-semibold">{deuda.titulo}</p>
        {deuda.vencidas.length > 0 && <p className="text-sm opacity-90">{deuda.texto}</p>}
      </button>

      {ciclo && (
        <div className="rounded-2xl bg-ciclo-fondo px-4 py-3 text-ciclo">
          <p className="font-semibold">
            Ciclo: día {ciclo.dia} · fase {ciclo.fase}
          </p>
          <p className="text-sm">
            Estimado · {ciclo.atrasado ? `próximo esperado el ${formatoFecha(ciclo.proximo)} (atrasado)` : `próximo ~${formatoFecha(ciclo.proximo)}`}
          </p>
        </div>
      )}

      <DatosFisicos alumno={alumno} pesos={pesos} onCambio={cargar} />
      <Competencias alumnoId={alumno.id} onMarca={() => setVersionMarcas((v) => v + 1)} />
      <Marcas key={versionMarcas} alumnoId={alumno.id} />

      <Pestanas
        valor={tab}
        onChange={setTab}
        opciones={[
          { valor: 'semana', texto: 'Semana' },
          { valor: 'pagos', texto: 'Pagos' },
          { valor: 'evolucion', texto: 'Evolución' },
        ]}
      />
      {tab === 'semana' && <TabSemana alumnoId={alumno.id} />}
      {tab === 'pagos' && <TabPagos alumno={alumno} cuotas={cuotas} pagos={pagos} onCambio={cargar} />}
      {tab === 'evolucion' && (
        <Suspense fallback={<Cargando />}>
          <EvolucionAlumno alumnoId={alumno.id} />
        </Suspense>
      )}

      <Acceso alumno={alumno} onCambio={cargar} />
      <p className="text-center text-xs text-texto-2">Alta: {fechaLarga(alumno.created_at.slice(0, 10))}</p>
    </Pantalla>
  )
}

function DatosFisicos({ alumno, pesos, onCambio }: { alumno: Alumno; pesos: Medicion[]; onCambio: () => void }) {
  const hoy = hoyPY()
  const [abierto, setAbierto] = useState(false)
  const [peso, setPeso] = useState('')
  const [error, setError] = useState('')
  const ultimo = pesos[pesos.length - 1]
  // Variación contra la medición más vieja de las últimas 8 semanas.
  const referencia = pesos.find((p) => diasEntre(p.fecha, hoy) <= 56)
  const variacion = ultimo && referencia && referencia !== ultimo ? ultimo.peso_kg - referencia.peso_kg : null
  const semanas = ultimo && referencia ? Math.max(1, Math.round(diasEntre(referencia.fecha, ultimo.fecha) / 7)) : 0

  async function guardar() {
    const kg = leerNumero(peso)
    if (!kg || kg < 25 || kg > 250) return setError('Ingresá un peso válido, por ejemplo 68,5.')
    const { error } = await supabase.from('mediciones').insert({ alumno_id: alumno.id, fecha: hoy, peso_kg: Math.round(kg * 10) / 10 })
    if (error) return setError(mensajeError(error))
    setPeso('')
    setError('')
    setAbierto(false)
    onCambio()
  }

  return (
    <Tarjeta>
      <div className="flex items-start justify-between gap-2">
        <div className="grid flex-1 grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-texto-2">Altura</p>
            <p className="font-mono text-lg font-semibold">{alumno.altura_cm ? `${alumno.altura_cm} cm` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-texto-2">Último peso {ultimo ? `(${formatoFecha(ultimo.fecha)})` : ''}</p>
            <p className="font-mono text-lg font-semibold">{ultimo ? `${formatoPeso(ultimo.peso_kg)} kg` : '—'}</p>
            {variacion !== null && (
              <p className="text-xs text-texto-2">
                {conSigno(variacion)} kg en {semanas} sem.
              </p>
            )}
          </div>
        </div>
        <Boton variante="borde" onClick={() => setAbierto(!abierto)}>
          + Peso
        </Boton>
      </div>
      {abierto && (
        <div className="mt-3 flex items-end gap-2">
          <Campo id="peso-hoy" label="Peso de hoy (kg)" inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} className="flex-1" />
          <Boton onClick={guardar}>Guardar</Boton>
        </div>
      )}
      <MensajeError>{error}</MensajeError>
    </Tarjeta>
  )
}
