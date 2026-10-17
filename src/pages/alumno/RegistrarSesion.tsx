import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { llamarFuncion } from '../../lib/api'
import { mensajeError } from '../../lib/consultas'
import { DIAS, diaSemana } from '../../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRango, formatoRitmo, leerDuracion, leerNumero } from '../../lib/formato'
import type { Molestia, SesionPlan, SesionReg, Split } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { useTipos } from '../../components/Semana'
import { AreaTexto, Boton, Campo, Cargando, EtiquetaTipo, MensajeError, Opciones, Pestanas, Tarjeta } from '../../components/ui'

type DatosGarmin = {
  distancia_km: number
  duracion_seg: number
  ritmo_prom_seg: number
  fc_prom: number | null
  fc_max: number | null
  splits: Split[]
  datos_crudos: unknown
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
  const [modo, setModo] = useState<'garmin' | 'manual'>('manual')

  // Formulario
  const [distancia, setDistancia] = useState('')
  const [tiempo, setTiempo] = useState('')
  const [fcProm, setFcProm] = useState('')
  const [fcMax, setFcMax] = useState('')
  const [sensacion, setSensacion] = useState<number | null>(null)
  const [molestia, setMolestia] = useState<Molestia | null>(null)
  const [comentario, setComentario] = useState('')

  // Garmin
  const [link, setLink] = useState('')
  const [leyendo, setLeyendo] = useState(false)
  const [garmin, setGarmin] = useState<DatosGarmin | null>(null)

  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState(false)

  useEffect(() => {
    ;(async () => {
      const [s, r] = await Promise.all([
        supabase.from('sesiones_planificadas').select('*').eq('id', sesionId!).maybeSingle(),
        supabase.from('sesiones_registradas').select('*').eq('sesion_planificada_id', sesionId!).maybeSingle(),
      ])
      setSesion(s.data as SesionPlan | null)
      const reg = r.data as SesionReg | null
      setExistente(reg)
      if (reg) {
        setDistancia(reg.distancia_km ? String(reg.distancia_km).replace('.', ',') : '')
        setTiempo(reg.duracion_seg ? formatoDuracion(reg.duracion_seg) : '')
        setFcProm(reg.fc_prom ? String(reg.fc_prom) : '')
        setFcMax(reg.fc_max ? String(reg.fc_max) : '')
        setSensacion(reg.sensacion)
        setComentario(reg.comentario_alumno ?? '')
        if (reg.origen === 'garmin' && reg.garmin_url) setLink(reg.garmin_url)
        const m = await supabase.from('molestias_ciclo').select('nivel').eq('sesion_registrada_id', reg.id).maybeSingle()
        setMolestia((m.data?.nivel as Molestia) ?? null)
      }
    })()
  }, [sesionId])

  const km = leerNumero(distancia)
  const seg = leerDuracion(tiempo)
  const ritmo = km && seg ? Math.round(seg / km) : null

  async function leerGarmin() {
    setError('')
    setGarmin(null)
    if (!/garmin\.com/.test(link)) return setError('Pegá el link de la actividad de Garmin Connect.')
    setLeyendo(true)
    const r = await llamarFuncion<DatosGarmin>('leer-garmin', { url: link.trim() })
    setLeyendo(false)
    if (r.error !== null) return setError(r.error)
    setGarmin(r.datos)
  }

  function usarGarmin() {
    if (!garmin) return
    setDistancia(String(garmin.distancia_km).replace('.', ','))
    setTiempo(formatoDuracion(garmin.duracion_seg))
    setFcProm(garmin.fc_prom ? String(garmin.fc_prom) : '')
    setFcMax(garmin.fc_max ? String(garmin.fc_max) : '')
  }

  async function guardar() {
    setError('')
    if (!km || km <= 0) return setError('Ingresá la distancia.')
    if (!seg || seg <= 0) return setError('Ingresá el tiempo, por ejemplo 52:30 o 1:05:10.')
    if (!sensacion) return setError('Elegí cómo te sentiste.')
    const desdeGarmin = modo === 'garmin' && garmin
    const fila = {
      sesion_planificada_id: sesionId,
      alumno_id: alumno.id,
      origen: desdeGarmin ? 'garmin' : 'manual',
      garmin_url: desdeGarmin ? link.trim() : null,
      distancia_km: Math.round(km * 100) / 100,
      duracion_seg: seg,
      ritmo_prom_seg: desdeGarmin ? garmin.ritmo_prom_seg : ritmo,
      fc_prom: leerNumero(fcProm),
      fc_max: leerNumero(fcMax),
      splits: desdeGarmin ? garmin.splits : (existente?.origen === 'garmin' ? existente.splits : []),
      datos_crudos: desdeGarmin ? garmin.datos_crudos : undefined,
      sensacion,
      comentario_alumno: comentario.trim() || null,
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
        <p className="text-texto-2">Tu entrenador ya la puede ver y evaluar.</p>
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
          {(sesion.ritmo_min_seg || sesion.ritmo_max_seg) && (
            <span className="font-mono text-sm text-texto-2">{formatoRango(sesion.ritmo_min_seg, sesion.ritmo_max_seg)}/km</span>
          )}
        </div>
        {sesion.estructura && <p className="mt-1 text-sm text-texto-2">{sesion.estructura}</p>}
      </Tarjeta>

      <Pestanas
        valor={modo}
        onChange={setModo}
        opciones={[
          { valor: 'garmin', texto: 'Link de Garmin' },
          { valor: 'manual', texto: 'Carga manual' },
        ]}
      />

      {modo === 'garmin' && (
        <Tarjeta className="flex flex-col gap-3">
          <Campo id="garmin-link" label="Link de la actividad" placeholder="https://connect.garmin.com/modern/activity/…" value={link} onChange={(e) => setLink(e.target.value)} />
          <Boton variante="oscuro" onClick={leerGarmin} disabled={leyendo}>
            {leyendo ? 'Leyendo…' : 'Leer'}
          </Boton>
          {garmin && (
            <div className="rounded-xl bg-fondo p-3 text-sm">
              <p className="mb-1 font-semibold">Datos leídos — revisalos:</p>
              <p className="font-mono">
                {formatoKm(garmin.distancia_km)} km · {formatoDuracion(garmin.duracion_seg)} · {formatoRitmo(garmin.ritmo_prom_seg)}/km
              </p>
              <p className="font-mono">
                FC {garmin.fc_prom ?? '—'} prom / {garmin.fc_max ?? '—'} máx · {garmin.splits.length} splits
              </p>
              <Boton className="mt-2 w-full" onClick={usarGarmin}>
                Usar estos datos
              </Boton>
            </div>
          )}
          <p className="text-xs text-texto-2">Si el link no se puede leer, usá la pestaña Carga manual.</p>
        </Tarjeta>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo id="reg-km" label="Distancia (km)" inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} />
        <Campo id="reg-tiempo" label="Tiempo" placeholder="52:30" value={tiempo} onChange={(e) => setTiempo(e.target.value)} />
        <Campo id="reg-fcp" label="FC promedio" inputMode="numeric" value={fcProm} onChange={(e) => setFcProm(e.target.value.replace(/\D/g, ''))} />
        <Campo id="reg-fcm" label="FC máxima" inputMode="numeric" value={fcMax} onChange={(e) => setFcMax(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="text-sm" aria-live="polite">
        Ritmo: <strong className="font-mono">{ritmo ? `${formatoRitmo(ritmo)}/km` : '—'}</strong> <span className="text-texto-2">(se calcula solo)</span>
      </p>

      <Opciones label="¿Cómo te sentiste?" valor={sensacion} onChange={setSensacion} opciones={SENSACIONES} />

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
