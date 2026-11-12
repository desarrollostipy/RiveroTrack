import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { cargarAlumno, cargarSemanas, esCompeticion, mensajeError, TIPOS_ELEGIBLES } from '../../lib/consultas'
import { kmPlanificados, textoWhatsApp } from '../../lib/calculos'
import { DIAS, diasDeSemana, hoyPY, lunesDe, rangoSemana, sumarDias } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoPpm, formatoRango, formatoRitmo, leerDuracion, leerNumero, leerRitmo } from '../../lib/formato'
import { esIntervalos, kmReps, REC_TIPOS, ritmoDeVuelta, textoReps, textoTiempo, type RecTipo } from '../../lib/intervalos'
import { estrategiaCarrera } from '../../lib/comunidad'
import type { Alumno, Competencia, Plan, Plantilla, SesionPlan } from '../../lib/tipos'
import { notificar } from '../../lib/push'
import { useCicloAlumna } from '../../lib/ciclo'
import { ChipFase } from '../../components/ciclo/CicloEntrenador'
import { usePlantillas } from './Plantillas'
import { CopiarAOtros } from './CopiarAOtros'
import { Pantalla } from '../../components/Pantalla'
import { useTipos } from '../../components/Semana'
import { AreaTexto, Boton, Campo, Cargando, EtiquetaTipo, MensajeError, MensajeOk, Opciones, Selector, SelectorPeriodo } from '../../components/ui'

// Sesión en edición: los números como texto, tal como se tipean.
type Borrador = {
  clave: string
  id?: string
  fecha: string
  turno: 1 | 2
  tipo: string
  resumen: string
  distancia: string
  duracion: string
  ritmoMin: string
  ritmoMax: string
  fcMin: string
  fcMax: string
  estructura: string
  notas: string
  reps: string
  repM: string
  repMin: string
  repMax: string
  recSeg: string
  recTipo: RecTipo | null
  /** Carrera vinculada (día de Competición). Undefined = la columna todavía no existe o no se tocó. */
  competenciaId?: string | null
  registrada?: boolean
}

let contador = 0
const nuevaClave = () => `n${++contador}`

const aBorrador = (s: SesionPlan, registrada = false): Borrador => ({
  clave: s.id,
  id: s.id,
  fecha: s.fecha,
  turno: s.turno,
  tipo: s.tipo,
  resumen: s.resumen ?? '',
  distancia: s.distancia_km ? String(s.distancia_km).replace('.', ',') : '',
  duracion: s.duracion_min ? String(s.duracion_min) : '',
  ritmoMin: s.ritmo_min_seg ? formatoRitmo(s.ritmo_min_seg) : '',
  ritmoMax: s.ritmo_max_seg ? formatoRitmo(s.ritmo_max_seg) : '',
  fcMin: s.fc_obj_min ? String(s.fc_obj_min) : '',
  fcMax: s.fc_obj_max ? String(s.fc_obj_max) : '',
  estructura: s.estructura ?? '',
  notas: s.notas ?? '',
  ...repsABorrador(s),
  competenciaId: s.competencia_id,
  registrada,
})

/** Campos de repeticiones de una sesión o plantilla, para el formulario. */
function repsABorrador(s: { reps?: number | null; rep_m?: number | null; rep_seg_min?: number | null; rep_seg_max?: number | null; rec_seg?: number | null; rec_tipo?: RecTipo | null }) {
  return {
    reps: s.reps ? String(s.reps) : '',
    repM: s.rep_m ? String(s.rep_m) : '',
    repMin: s.rep_seg_min ? textoTiempo(s.rep_seg_min) : '',
    repMax: s.rep_seg_max ? textoTiempo(s.rep_seg_max) : '',
    recSeg: s.rec_seg ? textoTiempo(s.rec_seg) : '',
    recTipo: s.rec_tipo ?? null,
  }
}

const aFila = (b: Borrador, planId: string) => {
  let min = leerRitmo(b.ritmoMin)
  let max = leerRitmo(b.ritmoMax)
  if (min && max && min > max) [min, max] = [max, min]
  // Pulso: con un solo valor se guarda como tope (fc_obj_max).
  let fcMin = leerNumero(b.fcMin), fcMax = leerNumero(b.fcMax)
  if (fcMin && !fcMax) [fcMin, fcMax] = [null, fcMin]
  if (fcMin && fcMax && fcMin > fcMax) [fcMin, fcMax] = [fcMax, fcMin]
  const fcValida = (n: number | null) => (n && n >= 60 && n <= 230 ? Math.round(n) : null)
  const descanso = b.tipo === 'descanso'
  const conReps = !descanso && esIntervalos(b.tipo)
  const reps = conReps ? leerNumero(b.reps) : null
  const repM = conReps ? leerNumero(b.repM) : null
  let repMin = conReps ? leerDuracion(b.repMin) : null
  let repMax = conReps ? leerDuracion(b.repMax) : null
  if (repMin && repMax && repMin > repMax) [repMin, repMax] = [repMax, repMin]
  const recSeg = conReps ? leerDuracion(b.recSeg) : null
  const r = reps && repM ? { reps: Math.round(reps), rep_m: Math.round(repM), rep_seg_min: repMin, rep_seg_max: repMax, rec_seg: recSeg, rec_tipo: b.recTipo } : null
  if (r && !min && !max && (repMin || repMax)) {
    min = repMin ? ritmoDeVuelta(repMin, r.rep_m) : null
    max = repMax ? ritmoDeVuelta(repMax, r.rep_m) : null
  }
  return {
    ...(b.id ? { id: b.id } : {}),
    plan_id: planId,
    fecha: b.fecha,
    turno: b.turno,
    tipo: b.tipo,
    resumen: b.resumen.trim() || (r ? `${r.reps}×${r.rep_m}` : null),
    distancia_km: descanso ? null : (leerNumero(b.distancia) ?? (r ? kmReps(r.reps, r.rep_m) : null)),
    duracion_min: descanso ? null : (leerNumero(b.duracion) ?? null),
    ritmo_min_seg: descanso ? null : min,
    ritmo_max_seg: descanso ? null : max,
    fc_obj_min: descanso ? null : fcValida(fcMin),
    fc_obj_max: descanso ? null : fcValida(fcMax),
    estructura: descanso ? null : b.estructura.trim() || (r ? textoReps(r) : null),
    notas: b.notas.trim() || null,
    reps: r?.reps ?? null,
    rep_m: r?.rep_m ?? null,
    rep_seg_min: r?.rep_seg_min ?? null,
    rep_seg_max: r?.rep_seg_max ?? null,
    rec_seg: r?.rec_seg ?? null,
    rec_tipo: r?.rec_tipo ?? null,
    // Solo se manda si la columna existe (evita romper el guardado si falta el SQL).
    ...(b.competenciaId !== undefined ? { competencia_id: esCompeticion(b.tipo) ? b.competenciaId : null } : {}),
  }
}

// Para cálculos y el texto de WhatsApp.
const aSesion = (b: Borrador): SesionPlan => ({ ...(aFila(b, '') as Omit<SesionPlan, 'id'>), id: b.id ?? b.clave } as SesionPlan)

export default function EditorPlan() {
  const { id: alumnoId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const hoy = hoyPY()
  const lunes = lunesDe(params.get('semana') || hoy)
  const { tipos, tipo } = useTipos()

  const [alumno, setAlumno] = useState<Alumno | null>(null)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [sesiones, setSesiones] = useState<Borrador[] | null>(null)
  const [nota, setNota] = useState('')
  const [borrados, setBorrados] = useState<string[]>([])
  const [abierto, setAbierto] = useState<string | null>(null)
  const [estadoGuardado, setEstadoGuardado] = useState<'' | 'pendiente' | 'guardando' | 'guardado'>('')
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [copiando, setCopiando] = useState(false)
  // Carreras del alumno (para vincular los días de Competición) y si ya corrió el SQL.
  const [carreras, setCarreras] = useState<Competencia[]>([])
  const [vinculoListo, setVinculoListo] = useState(false)
  const { plantillas, recargar: recargarPlantillas } = usePlantillas()
  // Fase estimada de cada día (solo si la alumna comparte su ciclo).
  const ciclo = useCicloAlumna(alumnoId!, alumno?.sexo === 'F' && !!alumno.comparte_ciclo)

  // ---------- Carga ----------
  useEffect(() => {
    let vigente = true
    setSesiones(null)
    setBorrados([])
    setEstadoGuardado('')
    setError('')
    setAviso('')
    Promise.all([cargarAlumno(alumnoId!), cargarSemanas({ alumnoId: alumnoId!, desde: lunes, hasta: lunes })]).then(([a, [s]]) => {
      if (!vigente) return
      setAlumno(a)
      setPlan(s ?? null)
      setNota(s?.nota_semana ?? '')
      setSesiones((s?.sesiones ?? []).map((x) => aBorrador(x, !!x.registro)))
    })
    return () => {
      vigente = false
    }
  }, [alumnoId, lunes])

  const recargarCarreras = useCallback(async () => {
    const { data } = await supabase.from('competencias').select('*').eq('alumno_id', alumnoId!).neq('estado', 'rechazada').order('fecha')
    setCarreras((data ?? []) as Competencia[])
    return (data ?? []) as Competencia[]
  }, [alumnoId])
  useEffect(() => {
    recargarCarreras()
    supabase
      .from('sesiones_planificadas')
      .select('competencia_id')
      .limit(1)
      .then(({ error }) => setVinculoListo(!error))
  }, [recargarCarreras])

  // ---------- Guardado automático ----------
  const estado = useRef({ plan, sesiones, nota, borrados })
  estado.current = { plan, sesiones, nota, borrados }
  const guardando = useRef<Promise<Plan | null> | null>(null)
  const temporizador = useRef<number | undefined>(undefined)

  const guardarAhora = useCallback(async (): Promise<Plan | null> => {
    window.clearTimeout(temporizador.current)
    if (guardando.current) await guardando.current
    const tarea = (async () => {
      const { plan: p, sesiones: ss, nota: n, borrados: bs } = estado.current
      if (!ss) return p
      setEstadoGuardado('guardando')
      try {
        let actual = p
        if (!actual) {
          const { data, error } = await supabase
            .from('planes_semanales')
            .upsert({ alumno_id: alumnoId, semana_inicio: lunes, nota_semana: n.trim() || null }, { onConflict: 'alumno_id,semana_inicio' })
            .select('*')
            .single()
          if (error) throw error
          actual = data as Plan
          setPlan(actual)
        } else if ((actual.nota_semana ?? '') !== n.trim()) {
          const { error } = await supabase.from('planes_semanales').update({ nota_semana: n.trim() || null }).eq('id', actual.id)
          if (error) throw error
          actual = { ...actual, nota_semana: n.trim() || null }
          setPlan(actual)
        }

        if (bs.length) {
          const { error } = await supabase.from('sesiones_planificadas').delete().in('id', bs)
          if (error) throw error
          setBorrados((prev) => prev.filter((x) => !bs.includes(x)))
        }

        // Las que ya existen se actualizan por id (puede cambiar el turno);
        // las nuevas se insertan.
        const existentes = ss.filter((b) => b.id)
        const nuevas = ss.filter((b) => !b.id)
        if (existentes.length) {
          const { error } = await supabase.from('sesiones_planificadas').upsert(existentes.map((b) => aFila(b, actual!.id)), { onConflict: 'id' })
          if (error) throw error
        }
        if (nuevas.length) {
          const { data, error } = await supabase
            .from('sesiones_planificadas')
            .upsert(nuevas.map((b) => aFila(b, actual!.id)), { onConflict: 'plan_id,fecha,turno' })
            .select('id, fecha, turno')
          if (error) throw error
          const ids = new Map((data ?? []).map((r: { id: string; fecha: string; turno: number }) => [`${r.fecha}-${r.turno}`, r.id]))
          setSesiones((prev) => prev?.map((b) => (b.id ? b : { ...b, id: ids.get(`${b.fecha}-${b.turno}`) })) ?? prev)
        }
        setEstadoGuardado('guardado')
        setError('')
        return actual
      } catch (e) {
        setEstadoGuardado('pendiente')
        setError(mensajeError(e, 'No se pudo guardar el plan.'))
        return null
      }
    })()
    guardando.current = tarea
    const r = await tarea
    guardando.current = null
    return r
  }, [alumnoId, lunes])

  // Si se sale de la pantalla con cambios sin guardar, se guardan igual.
  const pendiente = useRef(false)
  useEffect(() => {
    if (estadoGuardado === 'guardado') pendiente.current = false
  }, [estadoGuardado])
  useEffect(
    () => () => {
      if (pendiente.current) void guardarAhora()
    },
    [guardarAhora],
  )

  const marcarCambio = () => {
    pendiente.current = true
    setEstadoGuardado('pendiente')
    setAviso('')
    window.clearTimeout(temporizador.current)
    temporizador.current = window.setTimeout(() => guardarAhora(), 1200)
  }

  // ---------- Edición ----------
  function cambiar(clave: string, campos: Partial<Borrador>) {
    setSesiones((prev) => prev!.map((b) => (b.clave === clave ? { ...b, ...campos } : b)))
    marcarCambio()
  }

  // Al pasar a Competición, si el alumno tiene una carrera ese mismo día, se vincula sola.
  function conTipo(b: Borrador, codigo: string): Borrador {
    const n = { ...b, tipo: codigo }
    if (!esCompeticion(codigo) || !vinculoListo || b.competenciaId) return n
    const c = carreras.find((x) => x.fecha === b.fecha)
    return c ? { ...n, ...camposCarrera(n, c) } : n
  }

  function elegirTipoDia(fecha: string, codigo: string) {
    setSesiones((prev) => {
      const existentes = prev!.filter((b) => b.fecha === fecha)
      if (existentes.length) return prev!.map((b) => (b.fecha === fecha && b.turno === 1 ? conTipo(b, codigo) : b))
      return [...prev!, conTipo(vacio(fecha, 1, codigo), codigo)]
    })
    marcarCambio()
  }

  function cambiarTipo(clave: string, codigo: string) {
    setSesiones((prev) => prev!.map((b) => (b.clave === clave ? conTipo(b, codigo) : b)))
    marcarCambio()
  }

  function elegirCarrera(b: Borrador, c: Competencia | null) {
    cambiar(b.clave, c ? camposCarrera(b, c) : { competenciaId: null })
  }

  async function nuevaCarrera(b: Borrador, nombre: string, km: number | null) {
    const { data, error } = await supabase
      .from('competencias')
      .insert({ alumno_id: alumnoId, nombre, fecha: b.fecha, distancia_km: km })
      .select('*')
      .single()
    if (error) return mensajeError(error)
    await recargarCarreras()
    elegirCarrera(b, data as Competencia)
    setAviso(`Carrera "${nombre}" cargada y vinculada. El alumno la ve en Carreras.`)
    return ''
  }

  function agregarTurno(fecha: string) {
    setSesiones((prev) => [...prev!, vacio(fecha, 2, 'rodaje')])
    marcarCambio()
  }

  function quitar(b: Borrador) {
    if (b.registrada) return setError('Esta sesión ya fue registrada por el alumno: no se puede quitar.')
    setSesiones((prev) => {
      let resto = prev!.filter((x) => x.clave !== b.clave)
      // Si se quita el turno 1 y queda el 2, el 2 pasa a ser el único.
      if (b.turno === 1) resto = resto.map((x) => (x.fecha === b.fecha && x.turno === 2 && !x.registrada ? { ...x, turno: 1, clave: x.clave } : x))
      return resto
    })
    if (b.id) setBorrados((prev) => [...prev, b.id!])
    marcarCambio()
  }

  async function duplicarAnterior() {
    setError('')
    const [anterior] = await cargarSemanas({ alumnoId: alumnoId!, desde: sumarDias(lunes, -7), hasta: sumarDias(lunes, -7) })
    if (!anterior?.sesiones.length) return setError('La semana anterior no tiene plan para copiar.')
    if (sesiones!.some((b) => b.registrada)) return setError('Esta semana ya tiene sesiones registradas: no se puede reemplazar.')
    if (sesiones!.length && !confirm('Se reemplaza lo cargado en esta semana por la semana anterior. ¿Seguir?')) return
    const copiadas = anterior.sesiones.map((s) => ({ ...aBorrador({ ...s, fecha: sumarDias(s.fecha, 7) }), id: undefined, clave: nuevaClave() }))
    setBorrados((prev) => [...prev, ...(sesiones!.map((b) => b.id).filter(Boolean) as string[])])
    setSesiones(copiadas)
    if (!nota && anterior.nota_semana) setNota(anterior.nota_semana)
    setEstadoGuardado('pendiente')
    setAviso('Semana anterior copiada. Revisala y publicala.')
    // Se guarda después de que React aplique los cambios de arriba.
    window.setTimeout(async () => {
      const p = await guardarAhora()
      if (p) await supabase.from('planes_semanales').update({ copiado_de: anterior.id }).eq('id', p.id)
    }, 50)
  }

  async function publicar(estadoNuevo: 'publicado' | 'borrador') {
    const p = await guardarAhora()
    if (!p) return
    const { data, error } = await supabase
      .from('planes_semanales')
      .update({ estado: estadoNuevo, publicado_at: estadoNuevo === 'publicado' ? new Date().toISOString() : p.publicado_at })
      .eq('id', p.id)
      .select('*')
      .single()
    if (error) return setError(mensajeError(error))
    setPlan(data as Plan)
    if (estadoNuevo === 'publicado') notificar({ tipo: 'plan_publicado', alumno_ids: [alumnoId!], semana: lunes })
    setAviso(estadoNuevo === 'publicado' ? 'Plan publicado: el alumno ya lo ve.' : 'El plan volvió a borrador: el alumno no lo ve.')
  }

  function usarPlantilla(clave: string, p: Plantilla) {
    cambiar(clave, {
      tipo: p.tipo,
      resumen: p.resumen ?? '',
      distancia: p.distancia_km ? String(p.distancia_km).replace('.', ',') : '',
      duracion: p.duracion_min ? String(p.duracion_min) : '',
      ritmoMin: p.ritmo_min_seg ? formatoRitmo(p.ritmo_min_seg) : '',
      ritmoMax: p.ritmo_max_seg ? formatoRitmo(p.ritmo_max_seg) : '',
      fcMin: p.fc_obj_min ? String(p.fc_obj_min) : '',
      fcMax: p.fc_obj_max ? String(p.fc_obj_max) : '',
      estructura: p.estructura ?? '',
      notas: p.notas ?? '',
      ...repsABorrador(p),
    })
    setAviso(`Plantilla "${p.nombre}" aplicada.`)
  }

  async function guardarPlantilla(b: Borrador) {
    const nombre = prompt('Nombre de la plantilla', b.resumen || tipo(b.tipo).nombre)?.trim()
    if (!nombre) return
    const { id: _id, plan_id: _p, fecha: _f, turno: _t, competencia_id: _c, ...datos } = aFila(b, '') as ReturnType<typeof aFila> & { competencia_id?: string | null }
    const { error } = await supabase.from('plantillas_sesion').insert({ nombre, ...datos })
    if (error) return setError(mensajeError(error))
    setAviso(`Plantilla "${nombre}" guardada. La encontrás en cualquier día con 🧩.`)
    recargarPlantillas()
  }

  async function copiarWhatsApp() {
    const nombres = Object.fromEntries(tipos.map((t) => [t.codigo, t.nombre]))
    const texto = textoWhatsApp(sesiones!.map(aSesion), lunes, nombres, nota)
    try {
      await navigator.clipboard.writeText(texto)
      setAviso('Texto copiado. Pegalo en el chat del alumno.')
    } catch {
      setError('No se pudo copiar. Probá de nuevo.')
    }
  }

  async function irASemana(nuevoLunes: string) {
    if (estadoGuardado === 'pendiente') await guardarAhora()
    navigate(`/alumnos/${alumnoId}/plan?semana=${nuevoLunes}`, { replace: true })
  }

  if (!sesiones || !alumno) return <Cargando pantalla />

  const totalKm = sesiones.reduce((t, b) => t + kmPlanificados(aSesion(b)).km, 0)
  const estimado = sesiones.some((b) => kmPlanificados(aSesion(b)).estimado)
  // Solo Pista, Rodaje, Competición y Descanso (y el tipo que ya tenga una sesión vieja, para no perderlo).
  const posicion = (c: string) => (TIPOS_ELEGIBLES.includes(c) ? TIPOS_ELEGIBLES.indexOf(c) : 50)
  const opcionesTipo = (actual?: string) => {
    const elegibles = tipos.filter((t) => TIPOS_ELEGIBLES.includes(t.codigo) || t.codigo === actual)
    return (elegibles.length ? elegibles : tipos)
      .slice()
      .sort((a, b) => posicion(a.codigo) - posicion(b.codigo))
      .map((t) => ({ valor: t.codigo, texto: t.nombre, color: t.color }))
  }

  return (
    <div className="pb-[calc(5.5rem+env(safe-area-inset-bottom))]">
      <Pantalla titulo={`Plan de ${alumno.nombre.split(' ')[0]}`} volver={`/alumnos/${alumnoId}`}>
        <SelectorPeriodo
          texto={rangoSemana(lunes)}
          detalle={
            plan?.estado === 'publicado' ? (
              <span className="font-semibold text-ok">Publicado · el alumno ya lo ve</span>
            ) : (
              <span className="font-semibold text-parcial">Borrador · el alumno no lo ve</span>
            )
          }
          onAnterior={() => irASemana(sumarDias(lunes, -7))}
          onSiguiente={() => irASemana(sumarDias(lunes, 7))}
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Boton variante="borde" onClick={duplicarAnterior}>
              Duplicar semana anterior
            </Boton>
            <Boton variante="borde" onClick={async () => (await guardarAhora(), setCopiando(true))}>
              👥 Copiar a otros
            </Boton>
          </div>
          <p className="text-right text-sm text-texto-2" role="status">
            {estadoGuardado === 'guardando' ? 'Guardando…' : estadoGuardado === 'guardado' ? 'Guardado ✓' : estadoGuardado === 'pendiente' ? 'Cambios sin guardar' : ''}
            <br />
            <span className="font-mono font-semibold text-tinta">
              {estimado ? '≈' : ''}
              {formatoKm(totalKm)} km
            </span>
          </p>
        </div>

        <MensajeError>{error}</MensajeError>
        <MensajeOk>{aviso}</MensajeOk>

        <AreaTexto
          id="nota-semana"
          label="Nota de la semana (la ve el alumno)"
          rows={2}
          value={nota}
          onChange={(e) => (setNota(e.target.value), marcarCambio())}
        />

        <ul className="flex flex-col gap-2">
          {diasDeSemana(lunes).map((fecha, i) => {
            const delDia = sesiones.filter((b) => b.fecha === fecha).sort((a, b) => a.turno - b.turno)
            const estaAbierto = abierto === fecha
            const t1 = delDia[0]
            return (
              <li key={fecha} className={`rounded-2xl border bg-superficie ${fecha === hoy ? 'border-azul' : 'border-borde'}`}>
                <button
                  type="button"
                  aria-expanded={estaAbierto}
                  onClick={() => setAbierto(estaAbierto ? null : fecha)}
                  className="flex min-h-14 w-full items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {DIAS[i]} <span className="font-normal text-texto-2">{formatoFecha(fecha)}</span> <ChipFase e={ciclo.fase(fecha)} corto />
                    </span>
                    {delDia.length === 0 && <span className="text-sm text-texto-2">Sin sesión (descanso)</span>}
                    {delDia.map((b) => (
                      <span key={b.clave} className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                        <EtiquetaTipo nombre={tipo(b.tipo).nombre} color={tipo(b.tipo).color} />
                        <span className="truncate">{b.resumen}</span>
                        {(b.ritmoMin || b.ritmoMax) && (
                          <span className="font-mono text-xs text-texto-2">{formatoRango(leerRitmo(b.ritmoMin), leerRitmo(b.ritmoMax))}</span>
                        )}
                        {(b.fcMin || b.fcMax) && (
                          <span className="font-mono text-xs text-mal">❤ {formatoPpm(leerNumero(b.fcMin), leerNumero(b.fcMax))}</span>
                        )}
                      </span>
                    ))}
                  </span>
                  <span aria-hidden="true" className="text-azul">
                    {estaAbierto ? '▲' : '▼'}
                  </span>
                </button>

                {estaAbierto && (
                  <div className="flex flex-col gap-4 border-t border-borde p-3">
                    {delDia.length === 0 && (
                      <Opciones label="Tipo de sesión" valor={null} onChange={(c) => elegirTipoDia(fecha, c)} opciones={opcionesTipo()} />
                    )}
                    {delDia.map((b) => (
                      <div key={b.clave} className="flex flex-col gap-3">
                        {delDia.length > 1 && <p className="text-sm font-semibold text-azul">{b.turno === 1 ? 'Turno 1 · mañana' : 'Turno 2 · tarde'}</p>}
                        {b.registrada && <p className="text-sm text-ok">✓ El alumno ya registró esta sesión.</p>}
                        {plantillas && plantillas.length > 0 && (
                          <Selector
                            id={`plantilla-${b.clave}`}
                            label="🧩 Usar una plantilla"
                            value=""
                            onChange={(e) => {
                              const p = plantillas.find((x) => x.id === e.target.value)
                              if (p) usarPlantilla(b.clave, p)
                            }}
                          >
                            <option value="">Elegir…</option>
                            {plantillas.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre}
                              </option>
                            ))}
                          </Selector>
                        )}
                        <Opciones label="Tipo de sesión" valor={b.tipo} onChange={(c) => cambiarTipo(b.clave, c)} opciones={opcionesTipo(b.tipo)} />
                        {esCompeticion(b.tipo) && (
                          <BloqueCarrera
                            b={b}
                            carreras={carreras}
                            listo={vinculoListo}
                            onElegir={(c) => elegirCarrera(b, c)}
                            onNueva={(nombre, km) => nuevaCarrera(b, nombre, km)}
                          />
                        )}
                        {b.tipo !== 'descanso' && (
                          <>
                            <Campo
                              id={`res-${b.clave}`}
                              label="Resumen"
                              placeholder="Ej: 12 km · 6×1000 · 40 min"
                              value={b.resumen}
                              onChange={(e) => cambiar(b.clave, { resumen: e.target.value })}
                            />
                            {esIntervalos(b.tipo) && <BloqueReps b={b} cambiar={(c) => cambiar(b.clave, c)} />}
                            <div className="grid grid-cols-2 gap-3">
                              <Campo
                                id={`km-${b.clave}`}
                                label="Distancia (km)"
                                inputMode="decimal"
                                value={b.distancia}
                                onChange={(e) => cambiar(b.clave, { distancia: e.target.value })}
                              />
                              <Campo
                                id={`min-${b.clave}`}
                                label="Duración (min)"
                                inputMode="numeric"
                                value={b.duracion}
                                onChange={(e) => cambiar(b.clave, { duracion: e.target.value.replace(/\D/g, '') })}
                              />
                            </div>
                            <fieldset>
                              <legend className="mb-1 text-sm font-medium">Ritmo objetivo (min/km)</legend>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">de</span>
                                <input
                                  aria-label="Ritmo desde (más rápido)"
                                  placeholder="5:20"
                                  inputMode="numeric"
                                  className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono"
                                  value={b.ritmoMin}
                                  onChange={(e) => cambiar(b.clave, { ritmoMin: formatearRitmoTipeo(e.target.value) })}
                                />
                                <span className="text-sm">a</span>
                                <input
                                  aria-label="Ritmo hasta (más lento)"
                                  placeholder="5:40"
                                  inputMode="numeric"
                                  className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono"
                                  value={b.ritmoMax}
                                  onChange={(e) => cambiar(b.clave, { ritmoMax: formatearRitmoTipeo(e.target.value) })}
                                />
                              </div>
                            </fieldset>
                            <fieldset>
                              <legend className="mb-1 text-sm font-medium">Pulso objetivo (ppm)</legend>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">de</span>
                                <input
                                  aria-label="Pulso desde"
                                  placeholder="125"
                                  inputMode="numeric"
                                  className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono"
                                  value={b.fcMin}
                                  onChange={(e) => cambiar(b.clave, { fcMin: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                                />
                                <span className="text-sm">a</span>
                                <input
                                  aria-label="Pulso hasta"
                                  placeholder="135"
                                  inputMode="numeric"
                                  className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono"
                                  value={b.fcMax}
                                  onChange={(e) => cambiar(b.clave, { fcMax: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                                />
                              </div>
                              <p className="mt-1 text-xs text-texto-2">Para un solo valor (ej: rodaje a 130), completá solo uno de los dos.</p>
                            </fieldset>
                            <AreaTexto
                              id={`est-${b.clave}`}
                              label="Detalle / estructura"
                              placeholder="Ej: 6×1000 @4:05, rec 2′"
                              rows={2}
                              value={b.estructura}
                              onChange={(e) => cambiar(b.clave, { estructura: e.target.value })}
                            />
                          </>
                        )}
                        <Campo
                          id={`notas-${b.clave}`}
                          label="Notas para el alumno"
                          value={b.notas}
                          onChange={(e) => cambiar(b.clave, { notas: e.target.value })}
                        />
                        {b.tipo !== 'descanso' && (
                          <Boton variante="borde" onClick={() => guardarPlantilla(b)}>
                            🧩 Guardar como plantilla
                          </Boton>
                        )}
                        <Boton variante="peligro" onClick={() => quitar(b)}>
                          {delDia.length > 1 ? `Quitar turno ${b.turno}` : 'Quitar sesión'}
                        </Boton>
                      </div>
                    ))}
                    {delDia.length === 1 && t1.tipo !== 'descanso' && (
                      <Boton variante="texto" onClick={() => agregarTurno(fecha)}>
                        + Agregar 2º turno este día
                      </Boton>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </Pantalla>

      <CopiarAOtros
        abierta={copiando}
        onCerrar={() => setCopiando(false)}
        alumnoOrigen={alumnoId!}
        lunes={lunes}
        sesiones={sesiones.map((b) => aFila(b, ''))}
        nota={nota}
        onListo={(m) => setAviso(m)}
      />

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
        <div className="mx-auto flex max-w-xl gap-2">
          <Boton variante="borde" className="flex-1" onClick={copiarWhatsApp}>
            Copiar para WhatsApp
          </Boton>
          {plan?.estado === 'publicado' ? (
            <Boton variante="oscuro" className="flex-1" onClick={() => publicar('borrador')}>
              Pasar a borrador
            </Boton>
          ) : (
            <Boton className="flex-1" onClick={() => publicar('publicado')}>
              Publicar plan
            </Boton>
          )}
        </div>
      </div>
    </div>
  )
}

function vacio(fecha: string, turno: 1 | 2, tipo: string): Borrador {
  return { clave: nuevaClave(), fecha, turno, tipo, resumen: '', distancia: '', duracion: '', ritmoMin: '', ritmoMax: '', fcMin: '', fcMax: '', estructura: '', notas: '', reps: '', repM: '', repMin: '', repMax: '', recSeg: '', recTipo: 'trote' }
}

/** Al vincular una carrera se completan solos el resumen, la distancia, el ritmo y la nota (si estaban vacíos). */
function camposCarrera(b: Borrador, c: Competencia): Partial<Borrador> {
  const km = c.distancia_km ? Number(c.distancia_km) : null
  const est = km && c.tiempo_objetivo_seg ? estrategiaCarrera(km, c.tiempo_objetivo_seg) : null
  const cambia = !!b.competenciaId && b.competenciaId !== c.id // pasa de una carrera a otra: se pisa lo anterior
  const libre = (v: string) => cambia || !v.trim() || v.trim().startsWith('🏁')
  return {
    competenciaId: c.id,
    resumen: libre(b.resumen) ? `🏁 ${c.nombre}` : b.resumen,
    distancia: (cambia || !b.distancia) && km ? String(km).replace('.', ',') : b.distancia,
    ...(est && (cambia || (!b.ritmoMin && !b.ritmoMax))
      ? { ritmoMin: formatoRitmo(Math.round(est.ritmo - 5)), ritmoMax: formatoRitmo(Math.round(est.ritmo + 5)) }
      : {}),
    notas:
      (cambia || !b.notas.trim()) && c.tiempo_objetivo_seg
        ? `Objetivo ${formatoDuracion(c.tiempo_objetivo_seg)}. Mirá el modo carrera en la app.`
        : b.notas,
  }
}

/** Día de Competición: qué carrera va a correr el alumno (o cargar una nueva para ese día). */
function BloqueCarrera({
  b,
  carreras,
  listo,
  onElegir,
  onNueva,
}: {
  b: Borrador
  carreras: Competencia[]
  listo: boolean
  onElegir: (c: Competencia | null) => void
  onNueva: (nombre: string, km: number | null) => Promise<string>
}) {
  const [nueva, setNueva] = useState(false)
  const [nombre, setNombre] = useState('')
  const [km, setKm] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  if (!listo)
    return (
      <p className="rounded-2xl border border-dashed border-borde p-3 text-sm text-texto-2">
        🏁 Para vincular la carrera a este día falta activar la función en Supabase (SQL de tipos y competición).
      </p>
    )
  const elegida = carreras.find((c) => c.id === b.competenciaId) ?? null
  const desde = sumarDias(b.fecha, -14)
  const distanciaDias = (f: string) => Math.abs(new Date(f).getTime() - new Date(b.fecha).getTime())
  const opciones = carreras
    .filter((c) => c.fecha >= desde || c.id === b.competenciaId)
    .sort((x, y) => distanciaDias(x.fecha) - distanciaDias(y.fecha))
    .slice(0, 12)

  async function guardarNueva() {
    if (!nombre.trim()) return setError('Poné el nombre de la carrera.')
    const n = km.trim() ? leerNumero(km) : null
    if (km.trim() && (!n || n <= 0 || n > 400)) return setError('Revisá la distancia (en km).')
    setGuardando(true)
    const e = await onNueva(nombre.trim(), n)
    setGuardando(false)
    if (e) return setError(e)
    setNueva(false)
    setNombre('')
    setKm('')
    setError('')
  }

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-[#D99A0B]/40 bg-[#D99A0B]/10 p-3">
      <legend className="px-1 text-sm font-semibold">🏁 Carrera a realizar</legend>
      {opciones.length > 0 && (
        <Selector
          id={`carrera-${b.clave}`}
          label="Carrera"
          value={b.competenciaId ?? ''}
          onChange={(e) => onElegir(carreras.find((c) => c.id === e.target.value) ?? null)}
        >
          <option value="">Elegí la carrera…</option>
          {opciones.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre} · {formatoFecha(c.fecha)}
              {c.distancia_km ? ` · ${formatoKm(Number(c.distancia_km))} km` : ''}
              {c.estado === 'propuesta' ? ' (propuesta)' : ''}
            </option>
          ))}
        </Selector>
      )}
      {opciones.length === 0 && !nueva && <p className="text-sm text-texto-2">Este alumno no tiene carreras cargadas para estas fechas.</p>}
      {elegida && (
        <div className="text-sm">
          <p>
            <b>{elegida.nombre}</b> · {formatoFecha(elegida.fecha)}
            {elegida.hora_largada ? ` · largada ${elegida.hora_largada.slice(0, 5)}` : ''}
            {elegida.lugar ? ` · ${elegida.lugar}` : ''}
          </p>
          {elegida.tiempo_objetivo_seg && <p className="text-texto-2">Objetivo: {formatoDuracion(elegida.tiempo_objetivo_seg)}</p>}
          {elegida.fecha !== b.fecha && <p className="font-semibold text-parcial">⚠️ Esta carrera es el {formatoFecha(elegida.fecha)}, no este día.</p>}
          {elegida.estado === 'propuesta' && <p className="text-texto-2">El alumno la propuso y todavía no la aprobaste (Competencias).</p>}
          <p className="mt-1 text-texto-2">El alumno ve el modo carrera (ritmos, estrategia y clima) desde este día del plan.</p>
        </div>
      )}
      {!b.competenciaId && opciones.length > 0 && <p className="text-sm font-semibold text-parcial">Falta elegir qué carrera corre.</p>}
      {nueva ? (
        <div className="flex flex-col gap-2 rounded-xl bg-superficie p-3">
          <p className="text-sm font-semibold">Nueva carrera para el {formatoFecha(b.fecha)}</p>
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <Campo id={`nc-nombre-${b.clave}`} label="Nombre" placeholder="Ej: 10K Asunción" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            <Campo id={`nc-km-${b.clave}`} label="Km" placeholder="10" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
          </div>
          <MensajeError>{error}</MensajeError>
          <div className="flex gap-2">
            <Boton className="flex-1" onClick={guardarNueva} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar y vincular'}
            </Boton>
            <Boton variante="texto" onClick={() => (setNueva(false), setError(''))}>
              Cancelar
            </Boton>
          </div>
        </div>
      ) : (
        <Boton variante="texto" onClick={() => setNueva(true)}>
          + Cargar una carrera nueva para este día
        </Boton>
      )}
    </fieldset>
  )
}

// "520" → "5:20" mientras se tipea (teclado numérico del celular).
function formatearRitmoTipeo(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`
}

const DISTANCIAS_REP = [200, 400, 600, 800, 1000, 1600, 2000]

/** Pista / series: repeticiones, distancia de cada una, tiempo por vuelta y recuperación. */
function BloqueReps({ b, cambiar }: { b: Borrador; cambiar: (c: Partial<Borrador>) => void }) {
  const reps = leerNumero(b.reps)
  const repM = leerNumero(b.repM)
  const vMin = leerDuracion(b.repMin)
  const vMax = leerDuracion(b.repMax)
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border-2 border-azul/30 bg-azul/5 p-3">
      <legend className="px-1 text-sm font-semibold">🔁 Repeticiones</legend>
      <div className="grid grid-cols-2 gap-3">
        <Campo id={`reps-${b.clave}`} label="Cantidad" placeholder="15" inputMode="numeric" value={b.reps} onChange={(e) => cambiar({ reps: e.target.value.replace(/\D/g, '').slice(0, 3) })} />
        <Campo id={`repm-${b.clave}`} label="Distancia c/u (metros)" placeholder="400" inputMode="numeric" value={b.repM} onChange={(e) => cambiar({ repM: e.target.value.replace(/\D/g, '').slice(0, 5) })} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {DISTANCIAS_REP.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => cambiar({ repM: String(m) })}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${b.repM === String(m) ? 'border-azul bg-azul text-white' : 'border-borde bg-superficie'}`}
          >
            {m >= 1000 ? `${m / 1000} km` : `${m} m`}
          </button>
        ))}
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Tiempo por repetición</legend>
        <div className="flex items-center gap-2">
          <span className="text-sm">de</span>
          <input aria-label="Vuelta desde (más rápida)" placeholder="1:44" inputMode="numeric" className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono" value={b.repMin} onChange={(e) => cambiar({ repMin: formatearRitmoTipeo(e.target.value) })} />
          <span className="text-sm">a</span>
          <input aria-label="Vuelta hasta (más lenta)" placeholder="1:48" inputMode="numeric" className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono" value={b.repMax} onChange={(e) => cambiar({ repMax: formatearRitmoTipeo(e.target.value) })} />
        </div>
      </fieldset>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col text-sm font-medium">
          Recuperación
          <input aria-label="Tiempo de recuperación" placeholder="1:30" inputMode="numeric" className="min-h-11 w-24 rounded-xl border border-borde px-3 font-mono" value={b.recSeg} onChange={(e) => cambiar({ recSeg: formatearRitmoTipeo(e.target.value) })} />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {REC_TIPOS.map((r) => (
            <button
              key={r.valor}
              type="button"
              aria-pressed={b.recTipo === r.valor}
              onClick={() => cambiar({ recTipo: r.valor })}
              className={`min-h-11 rounded-xl border px-3 text-sm font-semibold ${b.recTipo === r.valor ? 'border-azul bg-azul text-white' : 'border-borde bg-superficie'}`}
            >
              {r.texto}
            </button>
          ))}
        </div>
      </div>
      {reps && repM ? (
        <p className="text-sm text-texto-2">
          = <b className="text-tinta">{formatoKm(kmReps(reps, repM))} km</b> de repeticiones
          {vMin || vMax ? (
            <>
              {' '}
              · ritmo ≈ <b className="font-mono text-tinta">{formatoRango(vMin ? ritmoDeVuelta(vMin, repM) : null, vMax ? ritmoDeVuelta(vMax, repM) : null)}/km</b>
            </>
          ) : null}
          . La distancia, el resumen y el ritmo se completan solos si los dejás vacíos.
        </p>
      ) : (
        <p className="text-xs text-texto-2">El alumno va a cargar cuántas hizo y su vuelta promedio.</p>
      )}
    </fieldset>
  )
}
