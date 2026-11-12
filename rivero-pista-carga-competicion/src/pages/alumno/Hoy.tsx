import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import { kmCorridos } from '../../lib/extras'
import { AvisoDescarga } from '../../components/salud/Descargas'
import { formatoKm } from '../../lib/formato'
import type { SesionCompleta, TipoSesion } from '../../lib/tipos'
import { Anillo, Hoja, Numero } from '../../components/ui'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useSesion } from '../../lib/sesion'
import { useMiAlumno } from '../../lib/alumno'
import { cargarSemanas, semanasEnMemoria } from '../../lib/consultas'
import { estadoDeuda } from '../../lib/calculos'
import { diasEntre, fechaLarga, hoyPY, lunesDe, nombreMes } from '../../lib/fechas'
import { formatoFecha, formatoGs } from '../../lib/formato'
import type { Competencia, Cuota, Evaluacion, Pago, SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { CuadritosSemana, ObjetivosSesion, TextoRegistro, useTipos } from '../../components/Semana'
import { Avatar, Boton, Cargando, estadoVigente, GloboEstado, Semaforo, Tarjeta, Titulo } from '../../components/ui'
import { MiCiclo } from './MiCiclo'
import { AnunciosAlumno, InvitarNotificaciones } from '../../components/AnunciosAlumno'
import { BienestarHoy } from '../../components/salud/Bienestar'
import { AvisoZapatillas } from '../../components/salud/Zapatillas'
import { ChipExtra, FormExtra } from '../../components/ActividadesExtra'
import { useExtras } from '../../lib/extras'
import { EnergiaHoy } from '../../components/Energia'
import { DISCIPLINAS, disciplinaDe } from '../../lib/disciplinas'

type Feedback = Evaluacion & { sesiones_planificadas: { fecha: string; resumen: string | null; tipo: string } | null }

export default function Hoy() {
  const { perfil } = useSesion()
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const hoy = hoyPY()
  const lunes = lunesDe(hoy)
  // Lo último visto se muestra al instante mientras se actualiza.
  const [semana, setSemana] = useState<SemanaCompleta | null | undefined>(() => {
    const g = semanasEnMemoria({ alumnoId: alumno.id, desde: lunes, hasta: lunes })
    return g ? (g[0] ?? null) : undefined
  })
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [competencia, setCompetencia] = useState<Competencia | null>(null)
  const [cuotas, setCuotas] = useState<(Cuota & { pagos: Pago | null })[]>([])

  const cargar = useCallback(async () => {
    const [s, f, c, q] = await Promise.all([
      cargarSemanas({ alumnoId: alumno.id, desde: lunes, hasta: lunes }),
      supabase.from('evaluaciones').select('*, sesiones_planificadas(fecha, resumen, tipo)').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('competencias').select('*').eq('alumno_id', alumno.id).eq('estado', 'aprobada').gte('fecha', hoy).order('fecha').limit(1).maybeSingle(),
      supabase.from('cuotas').select('*, pagos(*)').eq('alumno_id', alumno.id).order('periodo', { ascending: false }).limit(6),
    ])
    setSemana(s[0] ?? null)
    setFeedback(f.data as Feedback | null)
    setCompetencia(c.data as Competencia | null)
    setCuotas((q.data ?? []) as (Cuota & { pagos: Pago | null })[])
  }, [alumno.id, lunes, hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  // Al verlo, el último feedback queda marcado como leído.
  useEffect(() => {
    // .then() hace que la consulta se envíe de verdad.
    if (feedback && !feedback.leida_at) supabase.rpc('marcar_evaluacion_leida', { p_evaluacion_id: feedback.id }).then(() => {})
  }, [feedback])

  const fecha = fechaLarga(hoy)
  const deHoy = semana?.sesiones.filter((s) => s.fecha === hoy) ?? []
  const [orden, setOrden] = useState<BloqueInicio[]>(leerOrden)
  const [personalizar, setPersonalizar] = useState(false)
  const saludo = saludoSegunHora(new Date().getHours())
  const faltan = competencia ? diasEntre(hoy, competencia.fecha) : null
  const modoCarrera = competencia && faltan !== null && faltan <= 21

  // Km de la semana: lo corrido (con calentamiento y afloje) contra lo planificado.
  const activas = (semana?.sesiones ?? []).filter((s) => s.tipo !== 'descanso')
  const kmPlan = activas.reduce((t, s) => t + Number(s.distancia_km ?? 0), 0)
  const kmHecho = activas.reduce((t, s) => t + (s.registro ? kmCorridos(s.registro) : 0), 0)

  const bloques: Record<BloqueInicio['id'], ReactNode> = {
    hoy:
      semana === undefined ? (
        <Cargando />
      ) : (
        <TarjetaHoy
          deHoy={deHoy}
          haySemana={!!semana}
          tipo={tipo}
          kmPlan={kmPlan}
          kmHecho={kmHecho}
          mensaje={mensajeDelDia(saludo.momento, deHoy, !!semana)}
          extras={<ExtrasDeHoy alumnoId={alumno.id} />}
        />
      ),
    semana:
      semana === undefined ? null : (
        <Link to="/semana" aria-label="Ver mi semana" className="rounded-3xl border border-borde bg-superficie p-3">
          <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-texto-2">
            <span>Mi semana</span>
            <span className="font-mono normal-case tracking-normal">
              {activas.filter((s) => s.registro).length}/{activas.length} sesiones ›
            </span>
          </p>
          <CuadritosSemana sesiones={semana?.sesiones ?? []} lunes={lunes} hoy={hoy} hayPlan={!!semana} />
        </Link>
      ),
    energia: <EnergiaHoy alumnoId={alumno.id} />,
    feedback: feedback ? (
      <Tarjeta>
        <Titulo>💬 Último feedback</Titulo>
        <div className="flex flex-wrap items-center gap-2">
          <Semaforo resultado={feedback.resultado} />
          {feedback.sesiones_planificadas && (
            <span className="text-sm text-texto-2">
              {formatoFecha(feedback.sesiones_planificadas.fecha)} · {feedback.sesiones_planificadas.resumen || tipo(feedback.sesiones_planificadas.tipo).nombre}
            </span>
          )}
        </div>
        {feedback.comentario && <p className="mt-2 text-lg leading-snug">“{feedback.comentario}”</p>}
      </Tarjeta>
    ) : null,
    carrera: modoCarrera ? null : competencia ? (
      <Link
        to={disciplinaDe(competencia) === 'running' ? `/carrera/${competencia.id}` : '/carreras'}
        className="flex items-center justify-between gap-2 rounded-3xl border border-borde bg-superficie p-4 hover:border-azul/50"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-texto-2">Próxima competencia</p>
          <p className="font-semibold">
            {DISCIPLINAS[disciplinaDe(competencia)].emoji} {competencia.nombre}
          </p>
          <p className="text-sm text-texto-2">{formatoFecha(competencia.fecha)}</p>
          <p className="mt-1 text-sm font-semibold text-azul">{disciplinaDe(competencia) === 'running' ? '🏁 Modo carrera: ritmos y clima ›' : 'Ver en Carreras ›'}</p>
        </div>
        <p className="text-right">
          <span className="numero-brillo font-titulo text-4xl font-black">
            {faltan}
          </span>
          <span className="block text-xs text-texto-2">días</span>
        </p>
      </Link>
    ) : (
      <Link to="/carreras" className="flex min-h-14 items-center justify-between gap-2 rounded-3xl border border-dashed border-azul/60 bg-superficie px-4 py-3 text-azul">
        <span>
          <span className="block font-semibold">🏁 ¿Tenés una carrera en mente?</span>
          <span className="text-sm text-texto-2">Proponésela a tu entrenador</span>
        </span>
        <span aria-hidden="true">›</span>
      </Link>
    ),
    ciclo: alumno.sexo === 'F' ? <MiCiclo /> : null,
  }

  return (
    <Pantalla
      titulo={`${saludo.texto}, ${alumno.nombre.split(' ')[0]} ${saludo.emoji}`}
      subtitulo={fecha.charAt(0).toUpperCase() + fecha.slice(1)}
      derecha={
        <div className="flex items-start gap-2">
          {/* Mi perfil: foto con el estado arriba (como las notas de Instagram) */}
          <Link to="/perfil" aria-label="Mi perfil" className="relative flex flex-col items-center">
            {/* Foto con aro de color que gira, como las historias. */}
            <span className="rounded-full bg-[conic-gradient(from_0deg,#C8FF3D,#5B8BFF,#F0A6DB,#C8FF3D)] p-[3px]">
              <Avatar url={perfil?.avatar_url} nombre={alumno.nombre} tam={46} className="ring-2 ring-fondo" />
            </span>
            {perfil && estadoVigente(perfil) ? (
              <GloboEstado estado={estadoVigente(perfil)} className="mt-1 max-w-[7.5rem] whitespace-nowrap !px-2 !py-0.5 !text-[0.65rem]" />
            ) : (
              <span className="mt-1 whitespace-nowrap rounded-full border border-dashed border-borde bg-superficie px-2 text-[0.65rem] text-texto-2">+ estado</span>
            )}
          </Link>
        </div>
      }
    >
      <InvitarNotificaciones />
      <BienestarHoy alumnoId={alumno.id} />
      <AnunciosAlumno />
      <AvisoZapatillas alumnoId={alumno.id} />
      <AvisoCuota cuotas={cuotas} cuotaMensual={alumno.cuota_mensual} dia={alumno.dia_vencimiento} />
      <AvisoDescarga alumnoId={alumno.id} />

      {modoCarrera && competencia && faltan !== null && (
        <CuentaRegresiva competencia={competencia} faltan={faltan} hechas={activas.filter((s) => s.registro).length} plan={activas.length} kmPlan={kmPlan} />
      )}

      {orden
        .filter((b) => b.visible)
        .map((b) => (bloques[b.id] ? <Fragment key={b.id}>{bloques[b.id]}</Fragment> : null))}

      <button
        type="button"
        onClick={() => setPersonalizar(true)}
        className="mx-auto mt-1 min-h-11 rounded-full border border-borde bg-superficie px-4 text-sm font-semibold text-texto-2 hover:text-tinta"
      >
        ⚙️ Personalizar mi inicio
      </button>
      <Hoja titulo="Mi inicio" abierta={personalizar} onCerrar={() => setPersonalizar(false)}>
        <PersonalizarInicio
          orden={orden}
          onCambio={(o) => {
            setOrden(o)
            guardarOrden(o)
          }}
          esMujer={alumno.sexo === 'F'}
        />
      </Hoja>
    </Pantalla>
  )
}

function AvisoCuota({ cuotas, cuotaMensual, dia }: { cuotas: (Cuota & { pagos: Pago | null })[]; cuotaMensual: number; dia: number }) {
  const hoy = hoyPY()
  const [abierto, setAbierto] = useState(false)
  const deuda = estadoDeuda(cuotas, hoy)
  if (!deuda.vencidas.length) return null
  const primera = deuda.vencidas[0]
  const pagadas = cuotas.filter((c) => c.estado === 'pagada').slice(0, 3)
  return (
    <div className="rounded-2xl bg-mal text-white">
      <button type="button" aria-expanded={abierto} onClick={() => setAbierto(!abierto)} className="min-h-11 w-full px-4 py-3 text-left">
        <p className="font-semibold">
          {deuda.vencidas.length === 1
            ? `Cuota de ${nombreMes(primera.periodo).toLowerCase()} vencida · ${formatoGs(primera.monto)}`
            : `${deuda.vencidas.length} cuotas vencidas · ${formatoGs(deuda.total)}`}
        </p>
        <p className="text-sm opacity-90">
          Venció el {formatoFecha(primera.vencimiento)} · {abierto ? 'ocultar' : 'ver detalle'}
        </p>
      </button>
      {abierto && (
        <div className="rounded-b-2xl bg-superficie px-4 py-3 text-sm text-tinta">
          <p>
            Cuota mensual: <strong className="font-mono">{formatoGs(cuotaMensual)}</strong> · vence el día {dia}
          </p>
          {pagadas.length > 0 && (
            <ul className="mt-2">
              {pagadas.map((c) => (
                <li key={c.id} className="text-ok">
                  ✓ {nombreMes(c.periodo)} pagada{c.pagos ? ` el ${formatoFecha(c.pagos.fecha)}` : ''}
                </li>
              ))}
            </ul>
          )}
          <Link to="/pagos" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-azul font-semibold text-white">
            📤 Informar pago por transferencia
          </Link>
          <p className="mt-2 text-texto-2">Si pagaste en efectivo, tu entrenador lo registra y se actualiza acá.</p>
        </div>
      )}
    </div>
  )
}

// ---------- Saludo según la hora ----------

type Momento = 'manana' | 'tarde' | 'noche'
export function saludoSegunHora(hora: number): { texto: string; emoji: string; momento: Momento } {
  if (hora >= 5 && hora < 12) return { texto: 'Buen día', emoji: '☀️', momento: 'manana' }
  if (hora >= 12 && hora < 19) return { texto: 'Buenas tardes', emoji: '👋', momento: 'tarde' }
  return { texto: 'Buenas noches', emoji: '🌙', momento: 'noche' }
}

function mensajeDelDia(momento: Momento, deHoy: SesionCompleta[], haySemana: boolean): string {
  if (!haySemana) return 'Tu entrenador todavía no publicó el plan de esta semana.'
  const activas = deHoy.filter((s) => s.tipo !== 'descanso')
  if (!activas.length) return 'Hoy toca descansar: recuperar también es entrenar 😌'
  if (activas.every((s) => s.registro)) return '¡Sesión de hoy cumplida! 💪'
  if (momento === 'noche') return '¿Cómo te fue hoy? Cargá tu sesión antes de dormir.'
  if (momento === 'tarde') return '¿Ya entrenaste? Cuando termines, cargala acá.'
  return 'Hoy te toca: ¡a darle! 🔥'
}

// ---------- Inicio personalizable ----------

type IdBloque = 'hoy' | 'semana' | 'energia' | 'feedback' | 'carrera' | 'ciclo'
type BloqueInicio = { id: IdBloque; visible: boolean }
const NOMBRES_BLOQUE: Record<IdBloque, string> = {
  hoy: '⚡ Sesión de hoy',
  semana: '📅 Mi semana',
  energia: '🔥 Energía de hoy',
  feedback: '💬 Último feedback',
  carrera: '🏁 Próxima carrera',
  ciclo: '🌸 Mi ciclo',
}
const ORDEN_INICIAL: BloqueInicio[] = (['hoy', 'semana', 'energia', 'feedback', 'carrera', 'ciclo'] as IdBloque[]).map((id) => ({ id, visible: true }))
const CLAVE_INICIO = 'rivero-inicio'

function leerOrden(): BloqueInicio[] {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_INICIO) ?? 'null') as BloqueInicio[] | null
    if (!Array.isArray(g)) return ORDEN_INICIAL
    const validos = g.filter((b) => b && b.id in NOMBRES_BLOQUE)
    // Si en una versión nueva aparece otro bloque, se suma al final.
    return [...validos, ...ORDEN_INICIAL.filter((b) => !validos.some((v) => v.id === b.id))]
  } catch {
    return ORDEN_INICIAL
  }
}
function guardarOrden(o: BloqueInicio[]) {
  try {
    localStorage.setItem(CLAVE_INICIO, JSON.stringify(o))
  } catch {
    /* sin almacenamiento: vale solo por ahora */
  }
}

function PersonalizarInicio({ orden, onCambio, esMujer }: { orden: BloqueInicio[]; onCambio: (o: BloqueInicio[]) => void; esMujer: boolean }) {
  const mover = (i: number, d: -1 | 1) => {
    const o = [...orden]
    const j = i + d
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j], o[i]]
    onCambio(o)
  }
  return (
    <>
      <p className="text-sm text-texto-2">Elegí qué ver primero y qué ocultar. Se guarda en este celular.</p>
      <ol className="flex flex-col gap-2">
        {orden
          .map((b, i) => ({ b, i }))
          .filter(({ b }) => b.id !== 'ciclo' || esMujer)
          .map(({ b, i }) => (
            <li key={b.id} className={`flex items-center gap-2 rounded-2xl border border-borde bg-superficie p-2 pl-3 ${b.visible ? '' : 'opacity-55'}`}>
              <span className="flex-1 font-semibold">{NOMBRES_BLOQUE[b.id]}</span>
              <button type="button" aria-label={`Subir ${NOMBRES_BLOQUE[b.id]}`} onClick={() => mover(i, -1)} disabled={i === 0} className="h-10 w-10 rounded-xl border border-borde disabled:opacity-30">
                ↑
              </button>
              <button
                type="button"
                aria-label={`Bajar ${NOMBRES_BLOQUE[b.id]}`}
                onClick={() => mover(i, 1)}
                disabled={i === orden.length - 1}
                className="h-10 w-10 rounded-xl border border-borde disabled:opacity-30"
              >
                ↓
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={b.visible}
                aria-label={`Mostrar ${NOMBRES_BLOQUE[b.id]}`}
                onClick={() => onCambio(orden.map((x) => (x.id === b.id ? { ...x, visible: !x.visible } : x)))}
                className={`relative h-8 w-14 rounded-full transition-colors ${b.visible ? 'boton-accion' : 'bg-borde'}`}
              >
                <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${b.visible ? 'left-7' : 'left-1'}`} />
              </button>
            </li>
          ))}
      </ol>
      <Boton variante="borde" onClick={() => onCambio(ORDEN_INICIAL)}>
        Volver al orden original
      </Boton>
    </>
  )
}

// ---------- Tarjeta protagonista de hoy ----------

function TarjetaHoy({
  deHoy,
  haySemana,
  tipo,
  kmPlan,
  kmHecho,
  mensaje,
  extras,
}: {
  deHoy: SesionCompleta[]
  haySemana: boolean
  tipo: (c: string) => TipoSesion
  kmPlan: number
  kmHecho: number
  mensaje: string
  extras: ReactNode
}) {
  const principal = deHoy.find((s) => s.tipo !== 'descanso') ?? deHoy[0]
  const color = principal ? tipo(principal.tipo).color : '#2F6BFF'
  return (
    <section
      className="tarjeta-heroe rounded-[1.75rem] p-4 text-white shadow-[0_24px_48px_-24px_rgba(0,0,0,0.7)]"
      style={{ background: `linear-gradient(140deg, ${color} 0%, color-mix(in oklab, ${color} 55%, #050A1C) 100%)` }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-white/75">{principal ? `${tipo(principal.tipo).nombre} · hoy` : 'Hoy'}</p>
          <p className="mt-1 text-sm text-white/90">{mensaje}</p>
        </div>
        {kmPlan > 0 && (
          <Anillo pct={kmHecho / kmPlan} tam={78} grosor={8} fondo="rgba(255,255,255,0.18)">
            <span className="font-titulo text-lg font-black">
              <Numero valor={kmHecho} decimales={kmHecho % 1 ? 1 : 0} />
            </span>
            <span className="text-[0.6rem] text-white/75">de {formatoKm(kmPlan)} km</span>
          </Anillo>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-4">
        {deHoy.map((s) => {
          const t = tipo(s.tipo)
          return (
            <div key={s.id} className="flex flex-col gap-2">
              {deHoy.length > 1 && (
                <span className="self-start rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                  {s.turno === 1 ? 'Mañana' : 'Tarde'} · {t.nombre}
                </span>
              )}
              <p className="font-titulo text-4xl font-black leading-none tracking-tight">{s.resumen || t.nombre}</p>
              <div className="[&_li]:!bg-black/25 [&_li]:!text-white [&_p]:!bg-black/20 [&_p]:!text-white">
                <ObjetivosSesion s={s} grande />
              </div>
              {s.competencia_id && (
                <Link to={`/carrera/${s.competencia_id}`} className="flex min-h-11 items-center justify-between gap-2 rounded-2xl bg-black/25 px-3 py-2 font-semibold">
                  <span>🏁 Modo carrera: ritmos, estrategia y clima</span>
                  <span aria-hidden="true">›</span>
                </Link>
              )}
              {s.tipo !== 'descanso' &&
                (s.registro ? (
                  <div className="flex items-center justify-between gap-2 rounded-2xl bg-black/25 px-3 py-2">
                    <span className="[&_span]:!text-white">
                      <TextoRegistro s={s} />
                    </span>
                    <Link to={`/registrar/${s.id}`} className="flex min-h-10 items-center rounded-xl px-3 font-semibold text-white underline">
                      Editar
                    </Link>
                  </div>
                ) : (
                  <Link to={`/registrar/${s.id}`} className="boton-accion mt-1 flex min-h-13 items-center justify-center rounded-2xl text-lg font-bold">
                    Registrar sesión →
                  </Link>
                ))}
            </div>
          )
        })}
        {haySemana && deHoy.length === 0 && <p className="font-titulo text-3xl font-black">Descanso 😌</p>}
      </div>
      <div className="mt-2 [&_*]:!text-white [&>div]:!border-white/20">{extras}</div>
    </section>
  )
}

// ---------- Cuenta regresiva a la carrera (últimas 3 semanas) ----------

function CuentaRegresiva({ competencia, faltan, hechas, plan, kmPlan }: { competencia: Competencia; faltan: number; hechas: number; plan: number; kmPlan: number }) {
  const d = disciplinaDe(competencia)
  return (
    <Link
      to={d === 'running' ? `/carrera/${competencia.id}` : '/carreras'}
      className="tarjeta-heroe block rounded-[1.75rem] p-4 text-[#1B1300] shadow-[0_24px_48px_-24px_rgba(217,154,11,0.8)]"
      style={{ background: 'linear-gradient(135deg, #FFD66B 0%, #F2A81D 55%, #C97A06 100%)' }}
    >
      <p className="text-xs font-bold uppercase tracking-widest opacity-75">🏁 Modo carrera</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-titulo text-2xl font-black leading-tight">
            {DISCIPLINAS[d].emoji} {competencia.nombre}
          </p>
          <p className="text-sm font-semibold opacity-80">{formatoFecha(competencia.fecha)}</p>
        </div>
        <p className="shrink-0 text-right leading-none">
          <span className="font-titulo text-6xl font-black">{faltan === 0 ? '¡Hoy!' : faltan}</span>
          {faltan > 0 && <span className="block text-sm font-bold">{faltan === 1 ? 'día' : 'días'}</span>}
        </p>
      </div>
      {plan > 0 && (
        <p className="mt-3 rounded-2xl bg-black/10 px-3 py-2 text-sm font-semibold">
          Esta semana: {hechas}/{plan} sesiones{kmPlan ? ` · ${formatoKm(kmPlan)} km planificados` : ''}
          {faltan <= 7 ? ' · semana de puesta a punto 🎯' : ''}
        </p>
      )}
      {d === 'running' && <p className="mt-2 text-sm font-bold">Ver ritmos y clima del día ›</p>}
    </Link>
  )
}

/** Actividades extra de hoy (natación, bici…) y el botón para sumar otra. */
function ExtrasDeHoy({ alumnoId }: { alumnoId: string }) {
  const hoy = hoyPY()
  const { extras, recargarExtras } = useExtras(alumnoId, hoy, hoy)
  const [abierta, setAbierta] = useState(false)
  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-borde pt-3">
      {extras.map((x) => (
        <ChipExtra key={x.id} a={x} />
      ))}
      <button type="button" onClick={() => setAbierta(true)} className="self-start text-sm font-semibold text-[#0F6E78]">
        + Actividad extra (natación, bici, gimnasio…)
      </button>
      <FormExtra alumnoId={alumnoId} fecha={hoy} abierta={abierta} onCerrar={() => setAbierta(false)} onListo={recargarExtras} />
    </div>
  )
}
