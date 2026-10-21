import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { cargarSemanas } from '../../lib/consultas'
import { fechaLarga, hoyPY, lunesDe, sumarDias } from '../../lib/fechas'
import { formatoKm, formatoRitmo } from '../../lib/formato'
import { textoMolestia, type Bienestar, type Molestia } from '../../lib/salud'
import type { EntrenamientoGrupal, SemanaCompleta, SesionCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { useTipos } from '../../components/Semana'
import { EmojisBienestar } from '../../components/salud/Bienestar'
import { DEPORTES, kmCorridos, nombreActividad, type ActividadExtra } from '../../lib/extras'
import { Avatar, Cargando, EtiquetaTipo, SelectorPeriodo, Tarjeta, Vacio } from '../../components/ui'

type Fila = { alumnoId: string; nombre: string; avatar: string | null; sesiones: SesionCompleta[] }

/** Agenda del día: quién entrena, qué tiene cada uno, quién ya registró y cómo amaneció. */
export default function Agenda() {
  const hoy = hoyPY()
  const [dia, setDia] = useState(hoy)
  const [semanas, setSemanas] = useState<SemanaCompleta[] | null>(null)
  const [alumnos, setAlumnos] = useState<{ id: string; nombre: string; profile_id: string | null }[]>([])
  const [avatares, setAvatares] = useState<Record<string, string | null>>({})
  const [bienestar, setBienestar] = useState<Bienestar[]>([])
  const [molestias, setMolestias] = useState<Molestia[]>([])
  const [grupales, setGrupales] = useState<EntrenamientoGrupal[]>([])
  const [extras, setExtras] = useState<ActividadExtra[]>([])
  const { tipo } = useTipos()
  const lunes = lunesDe(dia)

  useEffect(() => {
    setSemanas(null)
    cargarSemanas({ desde: lunes, hasta: lunes }).then(setSemanas)
  }, [lunes])

  useEffect(() => {
    Promise.all([
      supabase.from('alumnos').select('id, nombre, profile_id').eq('activo', true),
      supabase.from('profiles').select('id, avatar_url').eq('rol', 'alumno'),
      supabase.from('molestias').select('*').is('resuelta_at', null),
    ]).then(([a, p, m]) => {
      setAlumnos((a.data ?? []) as typeof alumnos)
      setAvatares(Object.fromEntries(((p.data ?? []) as { id: string; avatar_url: string | null }[]).map((x) => [x.id, x.avatar_url])))
      setMolestias((m.data ?? []) as Molestia[])
    })
  }, [])

  useEffect(() => {
    Promise.all([
      supabase.from('bienestar_diario').select('*').eq('fecha', dia),
      supabase.from('entrenamientos_grupales').select('*').eq('fecha', dia).order('hora'),
      supabase.from('actividades_extra').select('*').eq('fecha', dia),
    ]).then(([b, g, x]) => {
      setBienestar((b.data ?? []) as Bienestar[])
      setGrupales((g.data ?? []) as EntrenamientoGrupal[])
      setExtras((x.data ?? []) as ActividadExtra[])
    })
  }, [dia])

  if (!semanas) return <Cargando pantalla />

  const filas: Fila[] = alumnos
    .map((a) => ({
      alumnoId: a.id,
      nombre: a.nombre,
      avatar: a.profile_id ? (avatares[a.profile_id] ?? null) : null,
      sesiones: semanas
        .filter((s) => s.alumno_id === a.id && s.estado === 'publicado')
        .flatMap((s) => s.sesiones)
        .filter((s) => s.fecha === dia && s.tipo !== 'descanso'),
    }))
    .filter((f) => f.sesiones.length > 0)
    .sort((x, y) => Number(x.sesiones.every((s) => s.registro)) - Number(y.sesiones.every((s) => s.registro)) || x.nombre.localeCompare(y.nombre))
  const hechos = filas.filter((f) => f.sesiones.every((s) => s.registro)).length
  const etiqueta = dia === hoy ? 'Hoy' : dia === sumarDias(hoy, 1) ? 'Mañana' : dia === sumarDias(hoy, -1) ? 'Ayer' : null

  return (
    <Pantalla titulo="Agenda" volver="/alumnos">
      <SelectorPeriodo texto={fechaLarga(dia)} detalle={etiqueta} onAnterior={() => setDia(sumarDias(dia, -1))} onSiguiente={() => setDia(sumarDias(dia, 1))} />

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-superficie p-3">
          <p className="font-titulo text-2xl font-extrabold">{filas.length}</p>
          <p className="text-xs text-texto-2">entrenan</p>
        </div>
        <div className="rounded-2xl bg-ok/10 p-3">
          <p className="font-titulo text-2xl font-extrabold text-ok">{hechos}</p>
          <p className="text-xs text-texto-2">registraron</p>
        </div>
        <div className="rounded-2xl bg-superficie p-3">
          <p className="font-titulo text-2xl font-extrabold">{bienestar.length}</p>
          <p className="text-xs text-texto-2">contaron cómo están</p>
        </div>
      </div>

      {grupales.map((g) => (
        <Link key={g.id} to={`/asistencia/${g.id}`} className="flex items-center gap-3 rounded-2xl bg-azul px-4 py-3 text-white">
          <span className="text-2xl" aria-hidden="true">
            📍
          </span>
          <span className="flex-1">
            <span className="block font-semibold">
              Entrenamiento grupal{g.hora ? ` · ${g.hora.slice(0, 5)}` : ''}
            </span>
            <span className="block text-sm text-white/85">{[g.lugar, g.descripcion].filter(Boolean).join(' · ') || 'Tomar asistencia'}</span>
          </span>
          <span aria-hidden="true">›</span>
        </Link>
      ))}

      {(() => {
        // Quienes solo hicieron una actividad extra (sin sesión planificada ese día).
        const sueltas = extras.filter((x) => !filas.some((f) => f.alumnoId === x.alumno_id))
        if (!sueltas.length) return null
        return (
          <Tarjeta>
            <p className="mb-1 font-semibold">Actividades extra</p>
            {sueltas.map((x) => (
              <p key={x.id} className="text-sm">
                {DEPORTES[x.deporte].emoji} <b>{alumnos.find((a) => a.id === x.alumno_id)?.nombre ?? 'Alumno'}</b> · {nombreActividad(x)} · {x.duracion_min} min
              </p>
            ))}
          </Tarjeta>
        )
      })()}

      {filas.length === 0 ? (
        <Vacio>Nadie tiene sesiones planificadas para este día.</Vacio>
      ) : (
        <Tarjeta className="p-0">
          <ul className="divide-y divide-borde">
            {filas.map((f) => {
              const b = bienestar.find((x) => x.alumno_id === f.alumnoId)
              const dolor = molestias.filter((m) => m.alumno_id === f.alumnoId).sort((x, y) => y.intensidad - x.intensidad)[0]
              return (
                <li key={f.alumnoId}>
                  <Link to={`/alumnos/${f.alumnoId}`} className="flex gap-3 p-3 hover:bg-fondo">
                    <Avatar url={f.avatar} nombre={f.nombre} tam={44} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-semibold">{f.nombre}</p>
                        {b && (
                          <span className="shrink-0 text-lg">
                            <EmojisBienestar b={b} />
                          </span>
                        )}
                      </div>
                      {f.sesiones.map((s) => {
                        const t = tipo(s.tipo)
                        return (
                          <div key={s.id} className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            <EtiquetaTipo nombre={t.nombre} color={t.color} />
                            <span className="truncate">{s.resumen || t.nombre}</span>
                            {s.registro ? (
                              <span className="font-mono font-semibold text-ok">
                                ✓ {kmCorridos(s.registro) ? `${formatoKm(kmCorridos(s.registro))} km` : 'hecho'}
                                {s.registro.ritmo_prom_seg ? ` · ${formatoRitmo(s.registro.ritmo_prom_seg)}` : ''}
                              </span>
                            ) : (
                              <span className="text-texto-2">⏳ pendiente</span>
                            )}
                          </div>
                        )
                      })}
                      {extras
                        .filter((x) => x.alumno_id === f.alumnoId)
                        .map((x) => (
                          <p key={x.id} className="mt-1 text-sm text-[#0F6E78]">
                            {DEPORTES[x.deporte].emoji} {nombreActividad(x)} · {x.duracion_min} min
                          </p>
                        ))}
                      {dolor && (
                        <p className={`mt-1 text-sm font-semibold ${dolor.intensidad >= 7 ? 'text-mal' : 'text-[#9A6B00]'}`}>
                          🩹 {textoMolestia(dolor)} · {dolor.intensidad}/10
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Tarjeta>
      )}
    </Pantalla>
  )
}
