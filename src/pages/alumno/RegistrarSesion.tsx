import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { llamarFuncion } from '../../lib/api'
import { cargarCuerpo, formatoKcal, kcalSesion, type DatosCuerpo } from '../../lib/calorias'
import { notificar } from '../../lib/push'
import { mensajeError } from '../../lib/consultas'
import { DIAS, diaSemana } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRitmo, leerDuracion, leerNumero } from '../../lib/formato'
import type { Molestia, SesionPlan, SesionReg, Split } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { BotonCompartir, imagenDeSesion } from '../../components/Compartir'
import { useZapatillas } from '../../components/salud/Zapatillas'
import { compararVuelta, esIntervalos, kmReps, textoDistanciaRep, textoReps } from '../../lib/intervalos'
import { kmRecuperacion, leerBloques, resumenBloque, resumenPista, type BloquePista } from '../../lib/pista'
import { EditorPista } from '../../components/PistaVueltas'
import { ObjetivosSesion, useTipos } from '../../components/Semana'
import { AreaTexto, Boton, Campo, Cargando, EtiquetaTipo, MensajeError, Opciones, Pestanas, Tarjeta } from '../../components/ui'

type DatosGarmin = {
  link: string
  titulo: string | null
  desnivel_m: number | null
  distancia_km: number
  duracion_seg: number
  ritmo_prom_seg: number
  fc_prom: number | null
  fc_max: number | null
  splits: Split[]
  datos_crudos: unknown
}

// Acepta el link solo o el mensaje entero que comparte la app de Garmin.
const linkGarmin = (texto: string) => {
  const id = texto.match(/garmin\.com\/[^\s]*?activity\/(\d{6,})/i)?.[1]
  return id ? `https://connect.garmin.com/modern/activity/${id}` : null
}

const SENSACIONES = [
  { valor: 1, texto: '1 · Muy mal' },
  { valor: 2, texto: '2 · Mal' },
  { valor: 3, texto: '3 · Normal' },
  { valor: 4, texto: '4 · Bien' },
  { valor: 5, texto: '5 · Excelente' },
]

export default function RegistrarSesion() {
  const { sesionId } = useParams()
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const [sesion, setSesion] = useState<SesionPlan | null | undefined>(undefined)
  const [existente, setExistente] = useState<SesionReg | null>(null)
  const [modo, setModo] = useState<'garmin' | 'manual'>('garmin')

  // Formulario
  const [distancia, setDistancia] = useState('')
  const [tiempo, setTiempo] = useState('')
  const [fcProm, setFcProm] = useState('')
  const [fcMax, setFcMax] = useState('')
  const [repsHechas, setRepsHechas] = useState('')
  const [vuelta, setVuelta] = useState('')
  const [calKm, setCalKm] = useState('')
  const [calMin, setCalMin] = useState('')
  const [aflKm, setAflKm] = useState('')
  const [aflMin, setAflMin] = useState('')
  // Pista vuelta por vuelta (el alumno arma los bloques al registrar).
  const [vueltaPorVuelta, setVueltaPorVuelta] = useState(false)
  const [bloquesPista, setBloquesPista] = useState<BloquePista[]>([])
  // Sin reloj (o con el GPS mal en la pista): la distancia sale de la pista y no se piden links.
  const [sinReloj, setSinReloj] = useState(false)
  const [ritmoSuave, setRitmoSuave] = useState(RITMO_SUAVE_BASE)
  // Calentamiento y afloje: también con su link de Garmin y su pulso.
  const [calLink, setCalLink] = useState('')
  const [calFcp, setCalFcp] = useState('')
  const [calFcm, setCalFcm] = useState('')
  const [aflLink, setAflLink] = useState('')
  const [aflFcp, setAflFcp] = useState('')
  const [aflFcm, setAflFcm] = useState('')
  const [calorias, setCalorias] = useState('')
  const [cuerpo, setCuerpo] = useState<DatosCuerpo | null>(null)
  const [sensacion, setSensacion] = useState<number | null>(null)
  const [molestia, setMolestia] = useState<Molestia | null>(null)
  const [comentario, setComentario] = useState('')
  const { lista: zapatillas } = useZapatillas(alumno.id)
  const [calzado, setCalzado] = useState<string | null | undefined>(undefined) // undefined = la principal

  // Garmin
  const [link, setLink] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [garmin, setGarmin] = useState<DatosGarmin | null>(null)

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    cargarCuerpo(alumno.id).then(setCuerpo)
    // Ritmo suave de cada uno (para pasar minutos de calentamiento a km): la mediana de sus
    // sesiones de 4 km o más, un poco más lenta. Sin datos, 6:30/km.
    supabase
      .from('sesiones_registradas')
      .select('distancia_km, ritmo_prom_seg')
      .eq('alumno_id', alumno.id)
      .order('fecha', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        const ritmos = ((data ?? []) as { distancia_km: number | null; ritmo_prom_seg: number | null }[])
          .filter((x) => Number(x.distancia_km) >= 4 && x.ritmo_prom_seg && x.ritmo_prom_seg >= 180 && x.ritmo_prom_seg <= 600)
          .map((x) => x.ritmo_prom_seg!)
          .sort((a, b) => a - b)
        if (ritmos.length >= 3) setRitmoSuave(Math.min(600, Math.max(270, ritmos[Math.floor(ritmos.length / 2)] + 30)))
      })
  }, [alumno.id])

  useEffect(() => {
    ;(async () => {
      const [s, r] = await Promise.all([
        supabase.from('sesiones_planificadas').select('*').eq('id', sesionId!).maybeSingle(),
        supabase.from('sesiones_registradas').select('*').eq('sesion_planificada_id', sesionId!).maybeSingle(),
      ])
      const plan = s.data as SesionPlan | null
      setSesion(plan)
      const reg = r.data as SesionReg | null
      if (plan?.reps) setRepsHechas(String(reg?.reps_hechas ?? plan.reps))
      if (reg?.rep_prom_seg) setVuelta(formatoDuracion(reg.rep_prom_seg))
      setExistente(reg)
      if (reg) {
        setDistancia(reg.distancia_km ? String(reg.distancia_km).replace('.', ',') : '')
        setTiempo(reg.duracion_seg ? formatoDuracion(reg.duracion_seg) : '')
        setFcProm(reg.fc_prom ? String(reg.fc_prom) : '')
        setFcMax(reg.fc_max ? String(reg.fc_max) : '')
        const txt = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '')
        setCalKm(txt(reg.calentamiento_km))
        setCalMin(txt(reg.calentamiento_min))
        setAflKm(txt(reg.afloje_km))
        setAflMin(txt(reg.afloje_min))
        setCalorias(reg.calorias ? String(reg.calorias) : '')
        const bp = leerBloques(reg.pista_bloques)
        if (bp.length) {
          setBloquesPista(bp)
          setVueltaPorVuelta(true)
          if (!reg.garmin_url) setSinReloj(true)
        }
        setCalLink(reg.calentamiento_garmin_url ?? '')
        setCalFcp(reg.calentamiento_fc_prom ? String(reg.calentamiento_fc_prom) : '')
        setCalFcm(reg.calentamiento_fc_max ? String(reg.calentamiento_fc_max) : '')
        setAflLink(reg.afloje_garmin_url ?? '')
        setAflFcp(reg.afloje_fc_prom ? String(reg.afloje_fc_prom) : '')
        setAflFcm(reg.afloje_fc_max ? String(reg.afloje_fc_max) : '')
        setSensacion(reg.sensacion)
        setComentario(reg.comentario_alumno ?? '')
        setCalzado(reg.calzado_id ?? null)
        if (reg.garmin_url) setLink(reg.garmin_url)
        else setModo('manual')
        const m = await supabase.from('molestias_ciclo').select('nivel').eq('sesion_registrada_id', reg.id).maybeSingle()
        setMolestia((m.data?.nivel as Molestia) ?? null)
      }
    })()
  }, [sesionId])

  const enUso = (zapatillas ?? []).filter((z) => !z.retirada)
  const calzadoElegido = calzado === undefined ? (enUso.find((z) => z.principal)?.id ?? null) : calzado

  // Pista / series: con repeticiones hechas y vuelta promedio salen la distancia y el tiempo (sin recuperación).
  const conReps = !!(sesion?.reps && sesion.rep_m)
  const conBloques = vueltaPorVuelta && bloquesPista.some((b) => resumenBloque(b))

  // Al cargar vueltas, la distancia y el tiempo (sin recuperación) salen solos.
  function cambiarBloques(b: BloquePista[]) {
    setBloquesPista(b)
    const r = resumenPista(b)
    if (r.km > 0) {
      setDistancia(String(r.km).replace('.', ','))
      setTiempo(formatoDuracion(r.segundos))
    }
  }
  // Si el profe dejó las repeticiones, se arranca con ese bloque (y su forma de recuperar).
  function empezarVueltas() {
    if (!bloquesPista.length && sesion?.reps && sesion.rep_m)
      setBloquesPista([{ distancia_m: sesion.rep_m, reps: Array.from({ length: sesion.reps }, () => ({ vueltas: [], rec_seg: null })), rec_modo: sesion.rec_tipo ?? null, rec_m: null }])
    setVueltaPorVuelta(true)
  }
  function corriSinReloj() {
    setSinReloj(true)
    setModo('manual')
    setGarmin(null)
    empezarVueltas()
  }
  function cambiarReps(n: string, v: string) {
    setRepsHechas(n)
    setVuelta(v)
    const cant = leerNumero(n)
    const seg = leerDuracion(v)
    if (cant && sesion?.rep_m) setDistancia(String(kmReps(cant, sesion.rep_m)).replace('.', ','))
    if (cant && seg) setTiempo(formatoDuracion(Math.round(cant * seg)))
  }

  const km = leerNumero(distancia)
  // Calentamiento y afloje: suman km, pero no cambian el ritmo de la parte principal.
  // Si solo se cargaron minutos, los km se estiman con el ritmo suave del alumno.
  const extraMin = (t: string) => (t.trim() ? leerNumero(t) : null)
  const estimarKm = (min: string) => {
    const m = extraMin(min)
    return m && m > 0 ? Math.round(((m * 60) / ritmoSuave) * 10) / 10 || null : null
  }
  const calEstimado = !calKm.trim() ? estimarKm(calMin) : null
  const aflEstimado = !aflKm.trim() ? estimarKm(aflMin) : null
  const extraKm = (t: string) => (t.trim() ? leerNumero(t) : null)
  const calKmFinal = extraKm(calKm) ?? calEstimado
  const aflKmFinal = extraKm(aflKm) ?? aflEstimado
  const recKm = conBloques ? kmRecuperacion(bloquesPista) : 0
  const totalKm = (km ?? 0) + (calKmFinal ?? 0) + (aflKmFinal ?? 0) + recKm
  const esPista = !!sesion && (esIntervalos(sesion.tipo) || conReps || vueltaPorVuelta)
  const seg = leerDuracion(tiempo)
  const ritmo = km && seg ? Math.round(seg / km) : null
  const estimadas =
    cuerpo && km && seg
      ? kcalSesion(
          { fecha: '', distancia_km: km, duracion_seg: seg, fc_prom: leerNumero(fcProm), calentamiento_km: calKmFinal, calentamiento_min: extraMin(calMin), afloje_km: aflKmFinal, afloje_min: extraMin(aflMin), calentamiento_fc_prom: calFcp ? leerNumero(calFcp) : null, afloje_fc_prom: aflFcp ? leerNumero(aflFcp) : null, recuperacion_km: recKm || null },
          cuerpo,
        ).kcal
      : null

  // Lee el resumen de Garmin y completa el formulario. El pulso no viene
  // (Garmin no lo comparte en el link público): se carga a mano si se quiere.
  async function leerGarmin(texto = link) {
    setError('')
    setGarmin(null)
    if (!linkGarmin(texto)) return setError('Pegá el link (o el mensaje) que comparte Garmin Connect.')
    setLeyendo(true)
    const r = await llamarFuncion<DatosGarmin>('leer-garmin', { url: texto.trim() })
    setLeyendo(false)
    if (r.error !== null) return setError(r.error)
    setGarmin(r.datos)
    // En pista manda la distancia de la pista: el GPS ahí suele marcar mal.
    if (conReps || conBloques) return
    setDistancia(String(r.datos.distancia_km).replace('.', ','))
    setTiempo(formatoDuracion(r.datos.duracion_seg))
  }

  async function guardar() {
    setError('')
    if (!km || km <= 0) return setError('Ingresá la distancia.')
    if (!seg || seg <= 0) return setError('Ingresá el tiempo, por ejemplo 52:30 o 1:05:10.')
    if (!sensacion) return setError('Elegí cómo te sentiste.')
    if (conReps && repsHechas.trim() && leerNumero(repsHechas) === null) return setError('Escribí cuántas repeticiones hiciste.')
    if (conBloques && bloquesPista.some((b) => b.rec_modo === 'trote' && !b.rec_m && b.reps.length > 1))
      return setError('Elegí cuántos metros trotaste en cada recuperación (o marcá "Caminando" o "Parado").')
    for (const [v, nombre] of [[calKm, 'los km del calentamiento'], [calMin, 'los minutos del calentamiento'], [aflKm, 'los km del afloje'], [aflMin, 'los minutos del afloje']] as const) {
      const n = v.trim() ? leerNumero(v) : null
      if (v.trim() && (!n || n <= 0)) return setError(`Revisá ${nombre}: tiene que ser un número mayor a cero.`)
    }
    for (const [v, nombre] of [[calFcp, 'el pulso promedio del calentamiento'], [calFcm, 'el pulso máximo del calentamiento'], [aflFcp, 'el pulso promedio del afloje'], [aflFcm, 'el pulso máximo del afloje']] as const) {
      const n = v.trim() ? leerNumero(v) : null
      if (v.trim() && (!n || n < 40 || n > 240)) return setError(`Revisá ${nombre}: va entre 40 y 240.`)
    }
    const extrasParte = {
      calentamiento_garmin_url: linkGarmin(calLink),
      calentamiento_fc_prom: calFcp ? leerNumero(calFcp) : null,
      calentamiento_fc_max: calFcm ? leerNumero(calFcm) : null,
      afloje_garmin_url: linkGarmin(aflLink),
      afloje_fc_prom: aflFcp ? leerNumero(aflFcp) : null,
      afloje_fc_max: aflFcm ? leerNumero(aflFcm) : null,
    }
    const habiaParte = existente && (existente.calentamiento_garmin_url || existente.calentamiento_fc_prom || existente.calentamiento_fc_max || existente.afloje_garmin_url || existente.afloje_fc_prom || existente.afloje_fc_max)
    // El link se guarda siempre que haya uno, aunque no se haya podido leer:
    // el entrenador lo abre para ver la actividad completa.
    const url = linkGarmin(link)
    const fila = {
      sesion_planificada_id: sesionId,
      alumno_id: alumno.id,
      origen: garmin || (url && existente?.origen === 'garmin') ? 'garmin' : 'manual',
      garmin_url: url,
      distancia_km: Math.round(km * 100) / 100,
      duracion_seg: seg,
      ritmo_prom_seg: ritmo,
      fc_prom: leerNumero(fcProm),
      fc_max: leerNumero(fcMax),
      reps_hechas: conReps && repsHechas.trim() ? Math.round(leerNumero(repsHechas) ?? 0) : null,
      rep_prom_seg: conReps ? leerDuracion(vuelta) : null,
      calentamiento_km: calKmFinal ? Math.round(calKmFinal * 100) / 100 : null,
      calentamiento_min: extraMin(calMin) ? Math.round(extraMin(calMin)!) : null,
      afloje_km: aflKmFinal ? Math.round(aflKmFinal * 100) / 100 : null,
      afloje_min: extraMin(aflMin) ? Math.round(extraMin(aflMin)!) : null,
      splits: existente?.splits ?? [],
      datos_crudos: garmin ? garmin.datos_crudos : undefined,
      sensacion,
      comentario_alumno: comentario.trim() || null,
      calzado_id: calzadoElegido,
      // Solo si se cargó (así no falla si la base todavía no tiene la columna).
      ...(calorias || existente?.calorias ? { calorias: calorias ? Math.round(leerNumero(calorias) ?? 0) || null : null } : {}),
      ...(Object.values(extrasParte).some((v) => v !== null) || habiaParte ? extrasParte : {}),
      // Pista vuelta por vuelta: solo si se usó (o si ya estaba guardada, para poder borrarla).
      ...(conBloques || existente?.pista_bloques ? { pista_bloques: conBloques ? bloquesPista : null } : {}),
      // Recuperaciones trotadas: solo si hay (así no falla si todavía no se corrió el SQL nuevo).
      ...(recKm > 0 || existente?.recuperacion_km ? { recuperacion_km: recKm > 0 ? recKm : null } : {}),
      // Con un solo bloque, también quedan las repeticiones y la vuelta promedio.
      ...(conBloques && bloquesPista.length === 1 && resumenBloque(bloquesPista[0])
        ? { reps_hechas: resumenBloque(bloquesPista[0])!.hechas, rep_prom_seg: resumenBloque(bloquesPista[0])!.promedio }
        : {}),
    }
    setGuardando(true)
    try {
      const q = existente
        ? supabase.from('sesiones_registradas').update(fila).eq('id', existente.id).select('id').single()
        : supabase.from('sesiones_registradas').insert(fila).select('id').single()
      const { data, error } = await q
      if (error) throw error
      const regId = (data as { id: string }).id
      if (alumno.sexo === 'F') {
        if (molestia) {
          const { error: e2 } = await supabase.from('molestias_ciclo').upsert({ sesion_registrada_id: regId, alumno_id: alumno.id, nivel: molestia })
          if (e2) throw e2
        } else {
          await supabase.from('molestias_ciclo').delete().eq('sesion_registrada_id', regId)
        }
      }
      if (!existente) notificar({ tipo: 'sesion', sesion_planificada_id: sesionId! })
      setListo(true)
    } catch (e) {
      setError(mensajeError(e))
    } finally {
      setGuardando(false)
    }
  }

  if (sesion === undefined) return <Cargando pantalla />
  if (sesion === null)
    return (
      <Pantalla titulo="Registrar sesión" volver="/hoy">
        <MensajeError>No se encontró la sesión planificada.</MensajeError>
      </Pantalla>
    )

  if (listo)
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-6xl" aria-hidden="true">
          ✅
        </p>
        <h1 className="font-titulo text-2xl font-extrabold">¡Sesión guardada!</h1>
        <p className="text-texto-2">
          {formatoKm(km!)} km · {formatoDuracion(seg!)} · {formatoRitmo(ritmo!)}/km
        </p>
        {totalKm > (km ?? 0) + 0.05 && (
          <p className="font-semibold">
            📏 Total del día: <span className="font-mono">{formatoKm(totalKm)} km</span>
          </p>
        )}
        <p className="text-texto-2">Tu entrenador ya la puede ver y evaluar.</p>
        <BotonCompartir
          variante="primario"
          className="w-full"
          nombreArchivo="rivero-entrenamiento.png"
          etiqueta="📤 Compartir mi entrenamiento"
          generar={(estilo) =>
            imagenDeSesion({
              estilo,
              planKm: sesion.distancia_km,
              registro: { pista_bloques: conBloques ? bloquesPista : null, reps_hechas: conReps ? leerNumero(repsHechas) : null, rep_prom_seg: conReps ? leerDuracion(vuelta) : null, rep_m: sesion.rep_m ?? null, fecha: sesion.fecha, distancia_km: km, calentamiento_km: calKmFinal, afloje_km: aflKmFinal, recuperacion_km: recKm || null, duracion_seg: seg, ritmo_prom_seg: ritmo, fc_prom: leerNumero(fcProm), sensacion, splits: garmin?.splits ?? existente?.splits ?? [], datos_crudos: garmin ? { desnivel_m: garmin.desnivel_m } : existente?.datos_crudos },
              tipo: tipo(sesion.tipo).nombre,
              titulo: sesion.resumen || tipo(sesion.tipo).nombre,
              nombre: alumno.nombre,
            })
          }
        />
        <Link to="/hoy" className="flex min-h-12 w-full items-center justify-center rounded-xl bg-azul font-semibold text-white">
          Volver a Hoy
        </Link>
        <Link to="/semana" className="flex min-h-11 w-full items-center justify-center rounded-xl font-semibold text-azul">
          Ver mi semana
        </Link>
      </main>
    )

  const t = tipo(sesion.tipo)

  return (
    <Pantalla titulo={existente ? 'Editar sesión' : 'Registrar sesión'} volver="/hoy">
      <Tarjeta>
        <p className="text-sm text-texto-2">
          {DIAS[diaSemana(sesion.fecha)]} {formatoFecha(sesion.fecha)}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <EtiquetaTipo nombre={t.nombre} color={t.color} />
          <span className="font-semibold">{sesion.resumen || t.nombre}</span>
        </div>
        <div className="mt-2">
          <ObjetivosSesion s={sesion} />
        </div>
      </Tarjeta>

      {esPista && !sinReloj && (
        <button
          type="button"
          onClick={corriSinReloj}
          className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-azul/40 bg-superficie p-3 text-left"
        >
          <span className="text-3xl" aria-hidden="true">
            ⌚
          </span>
          <span className="flex-1">
            <span className="block font-semibold">¿Corriste sin reloj o el GPS marcó mal?</span>
            <span className="block text-sm text-texto-2">Cargá solo tus tiempos: la distancia la calculamos con la pista.</span>
          </span>
          <span aria-hidden="true">›</span>
        </button>
      )}

      {sinReloj && (
        <div className="flex items-start gap-3 rounded-2xl bg-ok/10 p-3 text-sm" role="status">
          <span className="text-2xl" aria-hidden="true">
            📏
          </span>
          <p className="flex-1">
            <b>Sin reloj:</b> cargá el tiempo de cada repetición y cómo recuperaste. Los km salen solos con las medidas de la pista (400 m por vuelta).
          </p>
          <Boton variante="texto" className="!min-h-9 !px-2" onClick={() => setSinReloj(false)}>
            Tengo reloj
          </Boton>
        </div>
      )}

      {!sinReloj && (
        <Pestanas
          valor={modo}
          onChange={setModo}
          opciones={[
            { valor: 'garmin', texto: 'Link de Garmin' },
            { valor: 'manual', texto: 'Carga manual' },
          ]}
        />
      )}

      {modo === 'garmin' && !sinReloj && (
        <Tarjeta className="flex flex-col gap-3">
          <p className="text-sm text-texto-2">
            En la app <strong>Garmin Connect</strong>: abrí la actividad → <strong>Compartir</strong> → <strong>Copiar</strong>. Después pegalo acá.
          </p>
          <AreaTexto
            id="garmin-link"
            label="Link o mensaje de Garmin"
            rows={2}
            placeholder="Consulta mi actividad… https://connect.garmin.com/modern/activity/…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              // Al pegar, se lee solo.
              const pegado = e.clipboardData.getData('text')
              if (linkGarmin(pegado)) setTimeout(() => leerGarmin(pegado), 0)
            }}
          />
          <Boton variante="oscuro" onClick={() => leerGarmin()} disabled={leyendo}>
            {leyendo ? 'Leyendo…' : 'Leer'}
          </Boton>
          {garmin && (
            <div className="rounded-xl bg-ok/10 p-3 text-sm text-ok" role="status">
              <p className="font-semibold">✓ Leído de Garmin{garmin.titulo ? `: ${garmin.titulo}` : ''}</p>
              <p className="font-mono text-tinta">
                {formatoKm(garmin.distancia_km)} km · {formatoDuracion(garmin.duracion_seg)} · {formatoRitmo(garmin.ritmo_prom_seg)}/km
                {garmin.desnivel_m ? ` · ↑${garmin.desnivel_m} m` : ''}
              </p>
              <p className="mt-1 text-texto-2">
                {conBloques || conReps
                  ? 'En pista usamos la distancia de tus repeticiones, no la del GPS. El link queda guardado para tu entrenador.'
                  : 'Revisá los datos abajo. El pulso no viene en el link: si querés, cargalo a mano.'}
              </p>
            </div>
          )}
          <p className="text-xs text-texto-2">
            La actividad tiene que ser pública. Si no se puede leer, completá los datos abajo: el link queda guardado igual para tu entrenador.
          </p>
        </Tarjeta>
      )}

      {sesion && (esIntervalos(sesion.tipo) || vueltaPorVuelta) && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-azul/30 bg-azul/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">🏟️ Vuelta por vuelta</p>
            {vueltaPorVuelta && (
              <Boton variante="texto" className="!min-h-9" onClick={() => setVueltaPorVuelta(false)}>
                No usar
              </Boton>
            )}
          </div>
          {!vueltaPorVuelta ? (
            <>
              <p className="-mt-2 text-sm text-texto-2">Armá lo que hiciste (por ejemplo 6×800 y 4×400) y cargá el tiempo de cada vuelta de 400 m y tus recuperaciones.</p>
              <Boton onClick={empezarVueltas}>
                Cargar vuelta por vuelta
              </Boton>
            </>
          ) : (
            <>
              <EditorPista inicial={bloquesPista} onChange={cambiarBloques} />
              <p className="text-xs text-texto-2">La distancia y el tiempo de abajo se calculan solos con tus repeticiones (sin contar la recuperación).</p>
            </>
          )}
        </div>
      )}

      {conReps && sesion && !vueltaPorVuelta && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-azul/30 bg-azul/5 p-3">
          <p className="font-semibold">🔁 Repeticiones</p>
          <p className="-mt-2 text-sm text-texto-2">
            Objetivo: <b className="text-tinta">{textoReps(sesion)}</b>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="reg-reps" label="¿Cuántas hiciste?" inputMode="numeric" value={repsHechas} onChange={(e) => cambiarReps(e.target.value.replace(/\D/g, '').slice(0, 3), vuelta)} />
            <Campo id="reg-vuelta" label={`Vuelta promedio (${textoDistanciaRep(sesion.rep_m!)})`} placeholder="1:46" inputMode="numeric" value={vuelta} onChange={(e) => cambiarReps(repsHechas, formatearTiempoTipeo(e.target.value))} />
          </div>
          {(() => {
            const prom = leerDuracion(vuelta)
            const c = prom ? compararVuelta(prom, sesion.rep_seg_min, sesion.rep_seg_max) : null
            if (!c) return null
            return (
              <p className={`text-sm font-semibold ${c === 'en_rango' ? 'text-ok' : 'text-[#9A6B00]'}`}>
                {c === 'en_rango' ? '✓ Dentro del objetivo' : c === 'rapido' ? '⚡ Más rápido que el objetivo' : '🐢 Más lento que el objetivo'}
              </p>
            )
          })()}
          <p className="text-xs text-texto-2">
            La distancia y el tiempo de abajo se calculan solos con tus repeticiones (sin contar la recuperación). Si hiciste algo distinto, corregilos.
            {garmin && ' El link de Garmin quedó guardado, pero su total incluye las recuperaciones: por eso no lo usamos para el ritmo.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo id="reg-km" label={conReps ? 'Distancia de las repeticiones (km)' : 'Distancia principal (km)'} inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} />
        <Campo id="reg-tiempo" label={conReps ? 'Tiempo sin recuperación' : 'Tiempo'} placeholder="52:30" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        <Campo id="reg-fcp" label="FC promedio" inputMode="numeric" value={fcProm} onChange={(e) => setFcProm(e.target.value.replace(/\D/g, ''))} />
        <Campo id="reg-fcm" label="FC máxima" inputMode="numeric" value={fcMax} onChange={(e) => setFcMax(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="text-sm" aria-live="polite">
        Ritmo: <strong className="font-mono">{ritmo ? `${formatoRitmo(ritmo)}/km` : '—'}</strong> <span className="text-texto-2">(se calcula solo)</span>
      </p>
      <Campo
        id="reg-kcal"
        label="🔥 Calorías (opcional, si tu reloj las muestra)"
        inputMode="numeric"
        placeholder={estimadas ? `≈ ${estimadas}` : ''}
        ayuda={estimadas && !calorias ? `Si lo dejás vacío, usamos un estimado: ≈ ${formatoKcal(estimadas)}.` : undefined}
        value={calorias}
        onChange={(e) => setCalorias(e.target.value.replace(/\D/g, '').slice(0, 5))}
      />

      <details className="rounded-2xl border border-borde bg-superficie p-3" open={!!(calKm || calMin || aflKm || aflMin || calLink || aflLink || sinReloj)}>
        <summary className="cursor-pointer font-semibold">🔥 Calentamiento y 🧊 afloje <span className="font-normal text-texto-2">(opcional)</span></summary>
        <p className="mt-1 text-xs text-texto-2">
          Si los hiciste aparte de la parte principal, cargalos acá: suman a tus km de la semana, pero no cambian el ritmo de la sesión.
          {esPista && ' Sin reloj: poné las vueltas a la pista, o solo los minutos y calculamos los km con tu ritmo suave.'}
        </p>
        <ParteExtra
          id="cal"
          pista={esPista}
          sinReloj={sinReloj}
          estimado={calEstimado}
          ritmoSuave={ritmoSuave}
          titulo="🔥 Calentamiento"
          km={calKm}
          setKm={setCalKm}
          min={calMin}
          setMin={setCalMin}
          link={calLink}
          setLink={setCalLink}
          fcp={calFcp}
          setFcp={setCalFcp}
          fcm={calFcm}
          setFcm={setCalFcm}
        />
        <ParteExtra
          id="afl"
          pista={esPista}
          sinReloj={sinReloj}
          estimado={aflEstimado}
          ritmoSuave={ritmoSuave}
          titulo="🧊 Afloje / enfriamiento"
          km={aflKm}
          setKm={setAflKm}
          min={aflMin}
          setMin={setAflMin}
          link={aflLink}
          setLink={setAflLink}
          fcp={aflFcp}
          setFcp={setAflFcp}
          fcm={aflFcm}
          setFcm={setAflFcm}
        />
        {totalKm > (km ?? 0) && !esPista && (
          <p className="mt-2 text-sm">
            Total corrido: <strong className="font-mono">{formatoKm(totalKm)} km</strong>
          </p>
        )}
      </details>

      {esPista && totalKm > 0 && (
        <TotalDelDia
          partes={[
            { texto: '🔥 Calentamiento', km: calKmFinal, estimado: !!calEstimado },
            { texto: conBloques || conReps ? '🏟️ Series' : '🏃 Parte principal', km },
            { texto: '🔁 Recuperaciones trotadas', km: recKm || null },
            { texto: '🧊 Afloje', km: aflKmFinal, estimado: !!aflEstimado },
          ]}
          total={totalKm}
        />
      )}

      <Opciones label="¿Cómo te sentiste?" valor={sensacion} onChange={setSensacion} opciones={SENSACIONES} />

      {enUso.length > 0 && (
        <Opciones
          label="👟 Zapatillas"
          valor={calzadoElegido ?? 'ninguna'}
          onChange={(v) => setCalzado(v === 'ninguna' ? null : v)}
          opciones={[...enUso.map((z) => ({ valor: z.id, texto: z.nombre })), { valor: 'ninguna', texto: 'Otras' }]}
        />
      )}

      {alumno.sexo === 'F' && (
        <div>
          <Opciones
            label="Molestias del ciclo hoy (opcional)"
            valor={molestia}
            onChange={(v) => setMolestia(v === molestia ? null : v)}
            opciones={[
              { valor: 'ninguna', texto: 'Ninguna', color: '#8A3B75' },
              { valor: 'leves', texto: 'Leves', color: '#8A3B75' },
              { valor: 'fuertes', texto: 'Fuertes', color: '#8A3B75' },
            ]}
          />
          <p className="mt-1 text-xs text-texto-2">Tu entrenador lo ve solo si compartís tu ciclo.</p>
        </div>
      )}

      <AreaTexto id="reg-comentario" label="Comentario (opcional)" value={comentario} onChange={(e) => setComentario(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar} disabled={guardando} className="min-h-12">
        {guardando ? 'Guardando…' : 'Guardar sesión'}
      </Boton>
    </Pantalla>
  )
}

// "146" → "1:46" mientras se tipea.
function formatearTiempoTipeo(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  if (d.length <= 2) return d
  return `${d.slice(0, d.length - 2)}:${d.slice(-2)}`
}

/** Calentamiento + series + recuperaciones + afloje = total del día (en pista). */
function TotalDelDia({ partes, total }: { partes: { texto: string; km: number | null; estimado?: boolean }[]; total: number }) {
  const con = partes.filter((x) => x.km && x.km > 0)
  return (
    <Tarjeta>
      <p className="font-semibold">📏 Total del día</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm">
        {con.map((x) => (
          <li key={x.texto} className="flex justify-between gap-2">
            <span>
              {x.texto}
              {x.estimado && <span className="text-xs text-texto-2"> (estimado)</span>}
            </span>
            <span className="font-mono">{formatoKm(x.km!)} km</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-baseline justify-between border-t border-borde pt-2">
        <span className="font-semibold">Total corrido</span>
        <strong className="font-mono text-xl">{formatoKm(total)} km</strong>
      </p>
      <p className="mt-1 text-xs text-texto-2">Esto suma a tus km de la semana. El ritmo es solo el de las series.</p>
    </Tarjeta>
  )
}

const RITMO_SUAVE_BASE = 390 // 6:30/km, si todavía no hay sesiones para calcularlo

/** Calentamiento o afloje: km (o vueltas a la pista) y minutos, link de Garmin (completa km y min) y pulso. */
function ParteExtra(p: {
  id: string
  pista: boolean
  sinReloj: boolean
  estimado: number | null
  ritmoSuave: number
  titulo: string
  km: string
  setKm: (v: string) => void
  min: string
  setMin: (v: string) => void
  link: string
  setLink: (v: string) => void
  fcp: string
  setFcp: (v: string) => void
  fcm: string
  setFcm: (v: string) => void
}) {
  const [leyendo, setLeyendo] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')

  async function leer() {
    setError('')
    setAviso('')
    if (!linkGarmin(p.link)) return setError('Pegá el link (o el mensaje) que comparte Garmin Connect.')
    setLeyendo(true)
    const r = await llamarFuncion<DatosGarmin>('leer-garmin', { url: p.link.trim() })
    setLeyendo(false)
    if (r.error !== null) return setError(r.error)
    p.setLink(r.datos.link)
    p.setKm(String(r.datos.distancia_km).replace('.', ','))
    p.setMin(String(Math.max(1, Math.round(r.datos.duracion_seg / 60))))
    setAviso(`✓ Leído: ${formatoKm(r.datos.distancia_km)} km en ${formatoDuracion(r.datos.duracion_seg)}. El pulso no viene en el link: cargalo a mano si querés.`)
  }

  const conGarmin = !!linkGarmin(p.link)
  // Vueltas a la pista ↔ km (400 m cada una). Solo se muestra un número entero de vueltas.
  const kmNum = p.km.trim() ? leerNumero(p.km) : null
  const vueltas = kmNum ? kmNum / 0.4 : null
  const textoVueltas = vueltas && Math.abs(vueltas - Math.round(vueltas)) < 0.01 ? String(Math.round(vueltas)) : ''
  const ponerVueltas = (n: number) => p.setKm(n > 0 ? String(Math.round(n * 0.4 * 100) / 100).replace('.', ',') : '')
  return (
    <fieldset className="mt-3 flex flex-col gap-2 rounded-xl bg-fondo p-3">
      <legend className="sr-only">{p.titulo}</legend>
      <p className="font-semibold">{p.titulo}</p>
      {!p.sinReloj && (
        <div className="flex items-end gap-2">
          <Campo id={`reg-${p.id}-link`} className="flex-1" label="Link de Garmin (opcional)" placeholder="https://connect.garmin.com/…" value={p.link} onChange={(e) => p.setLink(e.target.value)} />
          <Boton variante="borde" onClick={leer} disabled={leyendo || !p.link.trim()}>
            {leyendo ? 'Leyendo…' : 'Leer'}
          </Boton>
        </div>
      )}
      {aviso && <p className="text-sm font-semibold text-ok">{aviso}</p>}
      <MensajeError>{error}</MensajeError>
      {p.pista && (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-medium">Vueltas a la pista</span>
          <Boton variante="borde" className="!min-h-10 !px-3" aria-label="Una vuelta menos" onClick={() => ponerVueltas(Math.max(0, Math.round(vueltas ?? 0) - 1))}>
            −
          </Boton>
          <input
            id={`reg-${p.id}-vueltas`}
            inputMode="numeric"
            aria-label={`Vueltas a la pista (${p.titulo})`}
            className="min-h-10 w-14 rounded-lg border border-borde bg-superficie text-center font-mono text-lg"
            placeholder="0"
            value={textoVueltas}
            onChange={(e) => ponerVueltas(Number(e.target.value.replace(/\D/g, '').slice(0, 3)) || 0)}
          />
          <Boton variante="borde" className="!min-h-10 !px-3" aria-label="Una vuelta más" onClick={() => ponerVueltas(Math.round(vueltas ?? 0) + 1)}>
            +
          </Boton>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Campo id={`reg-${p.id}-km`} label="Km" inputMode="decimal" placeholder={p.estimado ? `≈ ${formatoKm(p.estimado)}` : ''} value={p.km} onChange={(e) => p.setKm(e.target.value)} />
        <Campo id={`reg-${p.id}-min`} label="Minutos" inputMode="numeric" value={p.min} onChange={(e) => p.setMin(e.target.value.replace(/\D/g, ''))} />
        <Campo id={`reg-${p.id}-fcp`} label="FC promedio" inputMode="numeric" value={p.fcp} onChange={(e) => p.setFcp(e.target.value.replace(/\D/g, '').slice(0, 3))} />
        <Campo id={`reg-${p.id}-fcm`} label="FC máxima" inputMode="numeric" value={p.fcm} onChange={(e) => p.setFcm(e.target.value.replace(/\D/g, '').slice(0, 3))} />
      </div>
      {p.estimado && (
        <p className="text-xs font-semibold text-azul">
          ≈ {formatoKm(p.estimado)} km estimados con tu ritmo suave ({formatoRitmo(p.ritmoSuave)}/km). Si sabés los km o las vueltas, cargalos.
        </p>
      )}
      {conGarmin && !aviso && !p.sinReloj && <p className="text-xs text-texto-2">Tocá Leer para completar los km y los minutos desde Garmin.</p>}
    </fieldset>
  )
}