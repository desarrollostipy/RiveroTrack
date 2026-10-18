import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { supabase } from '../../lib/supabase'
import { gestionarAcceso } from '../../lib/api'
import { mensajeError } from '../../lib/consultas'
import { edad, hoyPY } from '../../lib/fechas'
import { formatoFecha, formatoPeso, leerMonto, miles } from '../../lib/formato'
import type { Alumno, Nivel } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Campo, Cargando, MensajeError, Opciones, Selector, Tarjeta, Vacio } from '../../components/ui'

export type Solicitud = {
  id: string
  ci: string
  nombre: string
  sexo: 'F' | 'M'
  fecha_nacimiento: string | null
  telefono: string | null
  objetivo: string | null
  nivel_declarado: Nivel | null
  altura_cm: number | null
  peso_kg: number | null
  comentario: string | null
  estado: 'pendiente' | 'aceptada' | 'rechazada'
  alumno_id: string | null
  created_at: string
  revisado_at: string | null
}

const NIVELES: { valor: Nivel; texto: string }[] = [
  { valor: 'principiante', texto: 'Principiante' },
  { valor: 'intermedio', texto: 'Intermedio' },
  { valor: 'avanzado', texto: 'Avanzado' },
]

// El entrenador revisa a los alumnos que se registraron solos y los da de alta.
export default function Solicitudes() {
  const [pendientes, setPendientes] = useState<Solicitud[] | null>(null)
  const [revisadas, setRevisadas] = useState<Solicitud[]>([])
  const [sinAcceso, setSinAcceso] = useState<Pick<Alumno, 'id' | 'nombre'>[]>([])
  const [config, setConfig] = useState({ monto: 0, dia: 10 })

  const cargar = useCallback(async () => {
    const [p, r, a, c] = await Promise.all([
      supabase.from('solicitudes_alta').select('*').eq('estado', 'pendiente').order('created_at'),
      supabase.from('solicitudes_alta').select('*').neq('estado', 'pendiente').order('revisado_at', { ascending: false }).limit(10),
      supabase.from('alumnos').select('id, nombre').is('profile_id', null).order('nombre'),
      supabase.from('config_cuotas').select('*').maybeSingle(),
    ])
    setPendientes((p.data ?? []) as Solicitud[])
    setRevisadas((r.data ?? []) as Solicitud[])
    setSinAcceso((a.data ?? []) as Alumno[])
    if (c.data) setConfig({ monto: c.data.monto_default, dia: c.data.dia_vencimiento_default })
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  return (
    <Pantalla titulo="Solicitudes de alta" subtitulo="Alumnos que se registraron desde la app" volver="/alumnos">
      {pendientes === null && <Cargando />}
      {pendientes?.length === 0 && <Vacio>No hay solicitudes pendientes.</Vacio>}
      {pendientes?.map((s) => (
        <TarjetaSolicitud key={s.id} s={s} sinAcceso={sinAcceso} config={config} onCambio={cargar} />
      ))}

      {revisadas.length > 0 && (
        <details className="rounded-2xl border border-borde bg-white p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Revisadas recientemente</summary>
          <ul className="flex flex-col divide-y divide-borde">
            {revisadas.map((s) => (
              <li key={s.id} className="flex justify-between py-2">
                <span>
                  {s.nombre} · CI {s.ci}
                </span>
                <span className={s.estado === 'aceptada' ? 'text-ok' : 'text-mal'}>
                  {s.estado === 'aceptada' ? 'Aceptada' : 'Rechazada'} {s.revisado_at ? formatoFecha(s.revisado_at) : ''}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Pantalla>
  )
}

function TarjetaSolicitud({
  s,
  sinAcceso,
  config,
  onCambio,
}: {
  s: Solicitud
  sinAcceso: Pick<Alumno, 'id' | 'nombre'>[]
  config: { monto: number; dia: number }
  onCambio: () => void
}) {
  const navigate = useNavigate()
  const [nivel, setNivel] = useState<Nivel>(s.nivel_declarado ?? 'principiante')
  const [cuota, setCuota] = useState(miles(config.monto))
  const [dia, setDia] = useState(String(config.dia))
  const [vincular, setVincular] = useState('')
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState(false)

  // Cuando llega la configuración general, precarga cuota y día.
  useEffect(() => {
    setCuota(miles(config.monto))
    setDia(String(config.dia))
  }, [config.monto, config.dia])

  // Si hay un alumno cargado a mano con el mismo nombre, sugerir vincularlo.
  useEffect(() => {
    const parecido = sinAcceso.find((a) => a.nombre.trim().toLowerCase() === s.nombre.trim().toLowerCase())
    if (parecido) setVincular(parecido.id)
  }, [sinAcceso, s.nombre])

  async function aceptar() {
    setError('')
    const d = Number(dia)
    if (!Number.isInteger(d) || d < 1 || d > 28) return setError('El día de vencimiento va de 1 a 28.')
    setTrabajando(true)
    const { data, error } = await supabase.rpc('aceptar_solicitud', {
      p_solicitud_id: s.id,
      p_nivel: nivel,
      p_cuota: leerMonto(cuota),
      p_dia: d,
      p_alumno_existente: vincular || null,
    })
    setTrabajando(false)
    if (error) return setError(mensajeError(error))
    navigate(`/alumnos/${data as string}`)
  }

  async function rechazar() {
    if (!confirm(`¿Rechazar la solicitud de ${s.nombre}? Se borra su acceso y no va a poder ingresar.`)) return
    setTrabajando(true)
    const r = await gestionarAcceso({ accion: 'rechazar-solicitud', solicitud_id: s.id })
    setTrabajando(false)
    if (r.error !== null) return setError(r.error)
    onCambio()
  }

  const anios = edad(s.fecha_nacimiento, hoyPY())

  return (
    <Tarjeta className="flex flex-col gap-3">
      <div>
        <p className="font-titulo text-lg font-extrabold">{s.nombre}</p>
        <p className="text-sm text-texto-2">
          CI {s.ci} · {s.sexo === 'F' ? 'Mujer' : 'Hombre'}
          {anios ? ` · ${anios} años` : ''} · se registró el {formatoFecha(s.created_at)}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {s.telefono && (
          <>
            <dt className="text-texto-2">Celular</dt>
            <dd>
              <a className="font-semibold text-azul underline" href={`https://wa.me/595${s.telefono.replace(/\D/g, '').replace(/^0/, '')}`} target="_blank" rel="noreferrer">
                {s.telefono}
              </a>
            </dd>
          </>
        )}
        {s.objetivo && (
          <>
            <dt className="text-texto-2">Objetivo</dt>
            <dd>{s.objetivo}</dd>
          </>
        )}
        {s.nivel_declarado && (
          <>
            <dt className="text-texto-2">Se considera</dt>
            <dd>{NIVELES.find((n) => n.valor === s.nivel_declarado)?.texto}</dd>
          </>
        )}
        {(s.altura_cm || s.peso_kg) && (
          <>
            <dt className="text-texto-2">Altura / peso</dt>
            <dd className="font-mono">
              {s.altura_cm ? `${s.altura_cm} cm` : '—'} / {s.peso_kg ? `${formatoPeso(s.peso_kg)} kg` : '—'}
            </dd>
          </>
        )}
      </dl>
      {s.comentario && <p className="rounded-xl bg-fondo px-3 py-2 text-sm">“{s.comentario}”</p>}

      <div className="flex flex-col gap-3 rounded-xl border border-azul/30 p-3">
        <p className="text-sm font-semibold text-azul">Para darlo de alta</p>
        <Opciones label="Nivel" valor={nivel} onChange={setNivel} opciones={NIVELES} />
        <div className="grid grid-cols-2 gap-3">
          <Campo id={`cuota-${s.id}`} label="Cuota mensual (Gs.)" inputMode="numeric" value={cuota} onChange={(e) => setCuota(miles(leerMonto(e.target.value)))} />
          <Campo id={`dia-${s.id}`} label="Vence el día (1 a 28)" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} />
        </div>
        {sinAcceso.length > 0 && (
          <Selector
            id={`vinc-${s.id}`}
            label="¿Ya lo tenías cargado? (opcional)"
            value={vincular}
            onChange={(e) => setVincular(e.target.value)}
            ayuda="Si lo cargaste a mano antes, elegilo para no duplicarlo: se le asigna este acceso."
          >
            <option value="">No, es un alumno nuevo</option>
            {sinAcceso.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </Selector>
        )}
      </div>

      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        <Boton variante="peligro" onClick={rechazar} disabled={trabajando} className="flex-1">
          Rechazar
        </Boton>
        <Boton onClick={aceptar} disabled={trabajando} className="flex-[2]">
          {trabajando ? 'Guardando…' : 'Aceptar y dar de alta'}
        </Boton>
      </div>
    </Tarjeta>
  )
}
