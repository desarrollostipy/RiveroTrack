import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { mensajeError } from '../../lib/consultas'
import { DIAS_CORTOS, diaSemana, diasEntre, hoyPY, nombreMes, primerDiaMes, sumarDias, sumarMeses } from '../../lib/fechas'
import { formatoFecha } from '../../lib/formato'
import {
  ANTICONCEPTIVOS,
  aprendizajes,
  COLICOS,
  CONDICIONES,
  esHormonal,
  estimarCicloPersonal,
  FASES,
  faseDelDia,
  FLUJOS,
  SINTOMAS,
  useCiclo,
  type Anticonceptivo,
  type Flujo,
  type NivelCompartir,
  type PerfilCiclo,
  type RegistroCiclo,
  type SintomasDia,
} from '../../lib/ciclo'
import { Pantalla } from '../../components/Pantalla'
import { Boton, Cargando, MensajeError, Opciones, Pestanas, Selector, Tarjeta, Titulo } from '../../components/ui'

type Tab = 'hoy' | 'calendario' | 'aprendido' | 'ajustes'

const AVISO_MEDICO = 'Todo es orientativo, calculado con tus datos. No reemplaza la consulta con tu ginecóloga o médico.'

/** Mi ciclo: perfil, síntomas, calendario, predicción con sus datos y privacidad. Solo alumnas. */
export default function Ciclo() {
  const { alumno } = useMiAlumno()
  const datos = useCiclo(alumno.id)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'hoy'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })

  if (alumno.sexo !== 'F') return <Pantalla titulo="Mi ciclo" volver="/perfil"><p className="text-texto-2">Esta sección es solo para alumnas.</p></Pantalla>
  if (datos.perfil === undefined) return <Pantalla titulo="Mi ciclo" volver="/hoy"><Cargando /></Pantalla>

  return (
    <Pantalla titulo="Mi ciclo" volver="/hoy">
      {!datos.perfil ? (
        <Tarjeta className="border-ciclo/30 bg-ciclo-fondo text-ciclo">
          <Titulo>🌸 Personalicemos tu ciclo</Titulo>
          <p className="mb-3 text-sm">Con unas preguntas rápidas las fechas y consejos se ajustan a vos. Lo ves solo vos, salvo lo que elijas compartir.</p>
          <FormPerfil alumnoId={alumno.id} perfil={null} onListo={datos.recargar} />
        </Tarjeta>
      ) : (
        <>
          <Pestanas
            valor={tab}
            onChange={setTab}
            opciones={[
              { valor: 'hoy', texto: '🌸 Hoy' },
              { valor: 'calendario', texto: '📅 Mes' },
              { valor: 'aprendido', texto: '💡 Vos' },
              { valor: 'ajustes', texto: '⚙️ Ajustes' },
            ]}
          />
          {tab === 'hoy' && <TabHoy alumnoId={alumno.id} {...datos} perfil={datos.perfil} />}
          {tab === 'calendario' && <TabCalendario alumnoId={alumno.id} {...datos} perfil={datos.perfil} />}
          {tab === 'aprendido' && <TabAprendido alumnoId={alumno.id} {...datos} perfil={datos.perfil} />}
          {tab === 'ajustes' && <TabAjustes alumnoId={alumno.id} {...datos} perfil={datos.perfil} />}
        </>
      )}
      <p className="text-center text-xs text-texto-2">{AVISO_MEDICO}</p>
    </Pantalla>
  )
}

type Datos = { alumnoId: string; registros: RegistroCiclo[]; perfil: PerfilCiclo; sintomas: SintomasDia[]; recargar: () => void }

// ---------------------------------------------------------------- Hoy

function TabHoy({ alumnoId, registros, perfil, sintomas, recargar }: Datos) {
  const hoy = hoyPY()
  const e = estimarCicloPersonal(registros, hoy, perfil)
  const ultimo = registros[0]
  const [error, setError] = useState('')
  const periodoAbierto = ultimo && !ultimo.fecha_fin && diasEntre(ultimo.fecha_inicio, hoy) < 12

  async function meVino(fecha = hoy) {
    setError('')
    const { error } = await supabase.from('ciclos_menstruales').insert({ alumno_id: alumnoId, fecha_inicio: fecha })
    if (error) return setError(error.code === '23505' ? 'Ya registraste un inicio ese día.' : mensajeError(error))
    recargar()
  }
  async function termino() {
    if (!ultimo) return
    const { error } = await supabase.from('ciclos_menstruales').update({ fecha_fin: hoy }).eq('id', ultimo.id)
    if (error) return setError(mensajeError(error))
    recargar()
  }

  return (
    <>
      <section className="rounded-2xl border border-ciclo/20 bg-ciclo-fondo p-4 text-ciclo" aria-label="Mi ciclo hoy">
        {e ? (
          <>
            <p className="text-sm font-semibold">Día {e.dia} de tu ciclo</p>
            {e.fase ? (
              <p className="font-titulo text-2xl font-extrabold">
                {FASES[e.fase].emoji} Fase {e.fase}
                <span className="block text-base font-semibold">{FASES[e.fase].resumen}</span>
              </p>
            ) : (
              <p className="font-titulo text-2xl font-extrabold">{e.enPeriodo ? '🩸 Con período' : '💊 Sin fases'}</p>
            )}
            <p className="mt-2 text-sm">
              {e.atrasado
                ? `Tu período se esperaba entre el ${formatoFecha(e.ventana[0])} y el ${formatoFecha(e.ventana[1])}.`
                : `Próximo período: entre el ${formatoFecha(e.ventana[0])} y el ${formatoFecha(e.ventana[1])}.`}
            </p>
            <p className="text-xs opacity-80">
              {e.aprendido ? `Calculado con tus últimos ciclos (≈ ${e.duracion} días).` : `Con lo que nos contaste (${e.duracion} días). Se ajusta a medida que registres.`}
              {e.irregular && ' Tu ciclo es variable: la ventana es más amplia.'}
            </p>
            {esHormonal(perfil.anticonceptivo) && (
              <p className="mt-2 text-xs">Con anticonceptivo hormonal no hay ovulación, por eso no mostramos fases. Igual podés registrar sangrados y síntomas.</p>
            )}
          </>
        ) : (
          <p>Registrá el inicio de tu período para ver el día del ciclo y la predicción.</p>
        )}
        <div className="mt-3 grid gap-2">
          {periodoAbierto ? (
            <Boton onClick={termino} className="!bg-ciclo text-white hover:!bg-ciclo/90">
              ✓ Terminó mi período
            </Boton>
          ) : (
            <Boton onClick={() => meVino()} className="!bg-ciclo text-white hover:!bg-ciclo/90">
              🩸 Me vino hoy
            </Boton>
          )}
        </div>
        <MensajeError>{error}</MensajeError>
        <Link to="?tab=ajustes" replace className="mt-3 flex min-h-11 items-center justify-between gap-2 rounded-xl bg-white/70 px-3 text-sm">
          <span>
            👁️ Tu entrenador ve:{' '}
            <b>{perfil.pausado ? 'nada (en pausa)' : perfil.compartir === 'nada' ? 'nada' : perfil.compartir === 'fase' ? 'fase y día' : 'fase y síntomas'}</b>
          </span>
          <span className="font-semibold underline">Cambiar</span>
        </Link>
      </section>

      {e?.fase && (
        <Tarjeta>
          <Titulo>Para entrenar</Titulo>
          <p>{FASES[e.fase].sugerencia}</p>
        </Tarjeta>
      )}

      <Tarjeta>
        <Titulo>¿Cómo te sentís hoy?</Titulo>
        <FormSintomas alumnoId={alumnoId} fecha={hoy} actual={sintomas.find((s) => s.fecha === hoy) ?? null} registros={registros} onListo={recargar} />
      </Tarjeta>
    </>
  )
}

/** Registro de un día: flujo, cólicos, síntomas y nota (un toque cada uno). */
function FormSintomas({
  alumnoId,
  fecha,
  actual,
  registros,
  onListo,
}: {
  alumnoId: string
  fecha: string
  actual: SintomasDia | null
  registros: RegistroCiclo[]
  onListo: () => void
}) {
  const [flujo, setFlujo] = useState<Flujo | null>(actual?.flujo ?? null)
  const [colicos, setColicos] = useState<number | null>(actual?.colicos ?? null)
  const [lista, setLista] = useState<string[]>(actual?.sintomas ?? [])
  const [nota, setNota] = useState(actual?.nota ?? '')
  const [estado, setEstado] = useState<'' | 'guardando' | 'listo'>('')
  const [error, setError] = useState('')

  useEffect(() => {
    setFlujo(actual?.flujo ?? null)
    setColicos(actual?.colicos ?? null)
    setLista(actual?.sintomas ?? [])
    setNota(actual?.nota ?? '')
  }, [actual, fecha])

  const alternar = (s: string) => setLista((l) => (l.includes(s) ? l.filter((x) => x !== s) : [...l, s]))

  async function guardar() {
    setError('')
    setEstado('guardando')
    const vacio = !flujo && colicos === null && !lista.length && !nota.trim()
    const r = vacio
      ? actual
        ? await supabase.from('sintomas_ciclo').delete().eq('id', actual.id)
        : { error: null }
      : await supabase
          .from('sintomas_ciclo')
          .upsert({ alumno_id: alumnoId, fecha, flujo, colicos, sintomas: lista, nota: nota.trim() || null }, { onConflict: 'alumno_id,fecha' })
    if (r.error) {
      setEstado('')
      return setError(mensajeError(r.error))
    }
    // Si marca flujo y no hay un período registrado cerca, ofrecemos registrar el inicio.
    if (flujo && flujo !== 'manchado' && !registros.some((x) => x.fecha_inicio <= fecha && diasEntre(x.fecha_inicio, fecha) < 10)) {
      if (confirm(`¿Marcamos el ${formatoFecha(fecha)} como inicio de tu período?`))
        await supabase.from('ciclos_menstruales').insert({ alumno_id: alumnoId, fecha_inicio: fecha })
    }
    setEstado('listo')
    onListo()
  }

  return (
    <div className="flex flex-col gap-3">
      <Opciones
        label="Sangrado"
        valor={flujo ?? ('sin' as Flujo)}
        onChange={(v) => setFlujo(v === ('sin' as Flujo) ? null : v)}
        opciones={[{ valor: 'sin' as Flujo, texto: 'No', color: 'var(--color-ciclo)' }, ...FLUJOS.map((f) => ({ valor: f.valor, texto: `${f.gotas} ${f.texto}`, color: 'var(--color-ciclo)' }))]}
      />
      <Opciones
        label="Cólicos"
        valor={colicos}
        onChange={setColicos}
        opciones={COLICOS.map((t, i) => ({ valor: i, texto: t, color: 'var(--color-ciclo)' }))}
      />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Otros síntomas</legend>
        <div className="flex flex-wrap gap-2">
          {SINTOMAS.map((s) => {
            const activo = lista.includes(s.valor)
            return (
              <button
                key={s.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => alternar(s.valor)}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${activo ? 'border-transparent bg-ciclo text-white' : 'border-borde bg-superficie text-tinta'}`}
              >
                <span aria-hidden="true">{s.emoji}</span> {s.texto}
              </button>
            )
          })}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nota (opcional)
        <input className="min-h-11 rounded-xl border border-borde bg-superficie px-3 text-base" maxLength={300} value={nota} onChange={(e) => setNota(e.target.value)} />
      </label>
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar} disabled={estado === 'guardando'} className="!bg-ciclo text-white hover:!bg-ciclo/90">
        {estado === 'guardando' ? 'Guardando…' : estado === 'listo' ? '✓ Guardado' : 'Guardar'}
      </Boton>
    </div>
  )
}

// ---------------------------------------------------------------- Calendario

type DiaCal = { fecha: string; real: boolean; previsto: boolean; fase: keyof typeof FASES | null; sintomas: boolean }

function TabCalendario({ alumnoId, registros, perfil, sintomas, recargar }: Datos) {
  const hoy = hoyPY()
  const [mes, setMes] = useState(primerDiaMes(hoy))
  const [elegido, setElegido] = useState<string | null>(null)
  const hormonal = esHormonal(perfil.anticonceptivo)

  const dias = useMemo<DiaCal[]>(() => {
    const fin = sumarDias(sumarMeses(mes, 1), -1)
    const est = estimarCicloPersonal(registros, hoy, perfil)
    const out: DiaCal[] = []
    for (let d = mes; d <= fin; d = sumarDias(d, 1)) {
      const real = registros.some((r) => {
        const hasta = r.fecha_fin ?? sumarDias(r.fecha_inicio, (est?.duracionPeriodo ?? 5) - 1)
        return d >= r.fecha_inicio && d <= hasta && d <= hoy
      })
      const f = faseDelDia(registros, d, perfil)
      out.push({ fecha: d, real, previsto: d > hoy && !real && !!f?.enPeriodo, fase: hormonal ? null : (f?.fase ?? null), sintomas: sintomas.some((s) => s.fecha === d) })
    }
    return out
  }, [mes, registros, perfil, sintomas, hoy, hormonal])

  const vacios = diaSemana(mes)
  return (
    <>
      <Tarjeta>
        <div className="mb-2 flex items-center justify-between">
          <Boton variante="texto" aria-label="Mes anterior" onClick={() => setMes(sumarMeses(mes, -1))}>
            ‹
          </Boton>
          <h2 className="font-titulo text-lg font-extrabold">
            {nombreMes(mes)} {mes.slice(0, 4)}
          </h2>
          <Boton variante="texto" aria-label="Mes siguiente" onClick={() => setMes(sumarMeses(mes, 1))}>
            ›
          </Boton>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-texto-2" aria-hidden="true">
          {DIAS_CORTOS.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: vacios }, (_, i) => (
            <span key={`v${i}`} />
          ))}
          {dias.map((d) => {
            const color = d.fase ? FASES[d.fase].color : null
            const estilo = d.real
              ? { background: FASES.menstrual.color, color: 'white' }
              : d.previsto
                ? { border: `2px dashed ${FASES.menstrual.color}`, color: FASES.menstrual.color }
                : color
                  ? { background: `${color}22` }
                  : undefined
            return (
              <button
                key={d.fecha}
                type="button"
                disabled={d.fecha > hoy}
                onClick={() => setElegido(d.fecha)}
                aria-label={`${formatoFecha(d.fecha)}${d.real ? ', período' : d.previsto ? ', período previsto' : d.fase ? `, fase ${d.fase}` : ''}${d.sintomas ? ', con síntomas' : ''}`}
                className={`relative flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm font-semibold ${d.fecha === hoy ? 'ring-2 ring-tinta' : ''} ${elegido === d.fecha ? 'outline outline-2 outline-ciclo' : ''} disabled:cursor-default`}
                style={estilo}
              >
                {Number(d.fecha.slice(8))}
                {d.sintomas && <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <li className="flex items-center gap-1">
            <span className="h-3 w-3 rounded" style={{ background: FASES.menstrual.color }} /> Período
          </li>
          <li className="flex items-center gap-1">
            <span className="h-3 w-3 rounded border-2 border-dashed" style={{ borderColor: FASES.menstrual.color }} /> Previsto
          </li>
          {!hormonal &&
            (['folicular', 'ovulatoria', 'lútea'] as const).map((f) => (
              <li key={f} className="flex items-center gap-1">
                <span className="h-3 w-3 rounded" style={{ background: `${FASES[f].color}55` }} /> {f.charAt(0).toUpperCase() + f.slice(1)}
              </li>
            ))}
          <li className="flex items-center gap-1">• Con síntomas</li>
        </ul>
        <p className="mt-2 text-xs text-texto-2">Tocá un día para ver o cargar cómo te sentiste.</p>
      </Tarjeta>

      {elegido && (
        <Tarjeta>
          <Titulo accion={<Boton variante="texto" onClick={() => setElegido(null)}>Cerrar</Boton>}>{formatoFecha(elegido)}</Titulo>
          <FormSintomas alumnoId={alumnoId} fecha={elegido} actual={sintomas.find((s) => s.fecha === elegido) ?? null} registros={registros} onListo={recargar} />
        </Tarjeta>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Lo que aprendimos

function TabAprendido({ alumnoId, registros, perfil, sintomas }: Datos) {
  const [extra, setExtra] = useState<{ bienestar: Parameters<typeof aprendizajes>[0]['bienestar']; sesiones: { fecha: string; sensacion: number | null }[] } | null>(null)
  useEffect(() => {
    const desde = sumarDias(hoyPY(), -400)
    Promise.all([
      supabase.from('bienestar_diario').select('fecha, energia, sueno, dolor, animo').eq('alumno_id', alumnoId).gte('fecha', desde),
      supabase.from('sesiones_registradas').select('fecha, sensacion').eq('alumno_id', alumnoId).gte('fecha', desde),
    ]).then(([b, s]) => setExtra({ bienestar: (b.data ?? []) as never, sesiones: (s.data ?? []) as never }))
  }, [alumnoId])

  if (!extra) return <Cargando />
  const textos = aprendizajes({ registros, perfil, sintomas, ...extra })
  const hormonal = esHormonal(perfil.anticonceptivo)
  return (
    <>
      <Tarjeta className="border-ciclo/30 bg-ciclo-fondo text-ciclo">
        <Titulo>💡 Lo que aprendimos de vos</Titulo>
        {textos.length ? (
          <ul className="flex list-disc flex-col gap-2 pl-5">
            {textos.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">
            Todavía no hay datos suficientes. Registrá al menos 2 períodos y completá “¿Cómo estás hoy?” y tus síntomas algunas veces: en unas semanas vas a ver tus patrones acá.
          </p>
        )}
        <p className="mt-3 text-xs opacity-80">Registrados: {registros.length} períodos · {sintomas.length} días con síntomas · {extra.bienestar.length} días de bienestar.</p>
      </Tarjeta>

      {!hormonal && (
        <Tarjeta>
          <Titulo>Cómo entrenar en cada fase</Titulo>
          <ul className="flex flex-col gap-3">
            {(Object.keys(FASES) as (keyof typeof FASES)[]).map((f) => (
              <li key={f} className="border-l-4 pl-3" style={{ borderColor: FASES[f].color }}>
                <p className="font-semibold">
                  {FASES[f].emoji} {f.charAt(0).toUpperCase() + f.slice(1)} · {FASES[f].resumen}
                </p>
                <p className="text-sm text-texto-2">{FASES[f].sugerencia}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-texto-2">Cada cuerpo es distinto: tus propios datos valen más que estas guías generales.</p>
        </Tarjeta>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Ajustes

function TabAjustes({ alumnoId, registros, perfil, recargar }: Datos) {
  const { recargar: recargarAlumno } = useMiAlumno()
  const [error, setError] = useState('')

  async function privacidad(nivel: NivelCompartir, pausado: boolean) {
    setError('')
    const { error } = await supabase.rpc('set_privacidad_ciclo', { p_nivel: nivel, p_pausado: pausado })
    if (error) return setError(mensajeError(error))
    recargar()
    recargarAlumno()
  }

  return (
    <>
      <Tarjeta>
        <Titulo>🔒 Qué ve tu entrenador</Titulo>
        <Opciones
          label="Compartir"
          valor={perfil.compartir}
          onChange={(v) => privacidad(v, perfil.pausado)}
          opciones={[
            { valor: 'nada', texto: 'Nada', color: 'var(--color-ciclo)' },
            { valor: 'fase', texto: 'Fase y día', color: 'var(--color-ciclo)' },
            { valor: 'sintomas', texto: 'Fase y síntomas', color: 'var(--color-ciclo)' },
          ]}
        />
        <p className="mt-2 text-sm text-texto-2">
          {perfil.compartir === 'nada'
            ? 'Solo lo ves vos.'
            : perfil.compartir === 'fase'
              ? 'Ve el día y la fase estimada para ajustar tu plan. No ve tus síntomas.'
              : 'Ve la fase y los síntomas que registres, con sus notas.'}
          {' '}Nunca ve tu anticonceptivo ni tus condiciones.
        </p>
        {perfil.compartir !== 'nada' && (
          <label className="mt-3 flex min-h-11 items-center justify-between gap-3 rounded-xl bg-fondo px-3 py-2">
            <span>
              <span className="block font-semibold">Pausar por ahora</span>
              <span className="text-sm text-texto-2">Deja de compartir sin perder lo que elegiste</span>
            </span>
            <input type="checkbox" role="switch" className="h-6 w-6 accent-ciclo" checked={perfil.pausado} onChange={(e) => privacidad(perfil.compartir, e.target.checked)} />
          </label>
        )}
        <MensajeError>{error}</MensajeError>
      </Tarjeta>

      <Tarjeta>
        <Titulo>🌸 Mi perfil del ciclo</Titulo>
        <FormPerfil alumnoId={alumnoId} perfil={perfil} onListo={recargar} />
      </Tarjeta>

      <Registros alumnoId={alumnoId} registros={registros} onCambio={recargar} />
    </>
  )
}

function FormPerfil({ alumnoId, perfil, onListo }: { alumnoId: string; perfil: PerfilCiclo | null; onListo: () => void }) {
  const { recargar: recargarAlumno } = useMiAlumno()
  const [duracion, setDuracion] = useState(perfil?.duracion_ciclo ? String(perfil.duracion_ciclo) : '')
  const [periodo, setPeriodo] = useState(perfil?.duracion_periodo ? String(perfil.duracion_periodo) : '')
  const [regular, setRegular] = useState<'si' | 'no' | 'nose'>(perfil?.regular === true ? 'si' : perfil?.regular === false ? 'no' : 'nose')
  const [anti, setAnti] = useState<Anticonceptivo>(perfil?.anticonceptivo ?? 'ninguno')
  const [condiciones, setCondiciones] = useState<string[]>(perfil?.condiciones ?? [])
  const [aviso, setAviso] = useState(perfil?.aviso_previo ?? false)
  // La primera vez también elige qué ve el entrenador (sin opción marcada de antemano).
  const [compartir, setCompartir] = useState<NivelCompartir | null>(null)
  const [error, setError] = useState('')
  const [guardado, setGuardado] = useState(false)

  async function guardar() {
    setError('')
    const d = duracion ? Number(duracion) : null
    const p = periodo ? Number(periodo) : null
    if (d !== null && (d < 18 || d > 60)) return setError('La duración del ciclo va entre 18 y 60 días.')
    if (p !== null && (p < 1 || p > 12)) return setError('El período dura entre 1 y 12 días.')
    if (!perfil && !compartir) return setError('Elegí qué querés que vea tu entrenador.')
    const { error } = await supabase.from('perfil_ciclo').upsert(
      {
        alumno_id: alumnoId,
        duracion_ciclo: d,
        duracion_periodo: p,
        regular: regular === 'nose' ? null : regular === 'si',
        anticonceptivo: anti,
        condiciones,
        aviso_previo: aviso,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'alumno_id' },
    )
    if (error) return setError(mensajeError(error))
    if (!perfil && compartir) {
      const r = await supabase.rpc('set_privacidad_ciclo', { p_nivel: compartir, p_pausado: false })
      if (r.error) return setError(mensajeError(r.error))
      recargarAlumno()
    }
    setGuardado(true)
    onListo()
  }

  return (
    <div className="flex flex-col gap-3 text-tinta">
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tu ciclo dura (días)
          <input type="number" inputMode="numeric" min={18} max={60} placeholder="ej. 28" className="min-h-11 rounded-xl border border-borde bg-superficie px-3 text-base" value={duracion} onChange={(e) => setDuracion(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Tu período dura (días)
          <input type="number" inputMode="numeric" min={1} max={12} placeholder="ej. 5" className="min-h-11 rounded-xl border border-borde bg-superficie px-3 text-base" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </label>
      </div>
      <p className="-mt-2 text-xs text-texto-2">Si no sabés, dejalo vacío: lo calculamos con tus registros.</p>
      <Opciones
        label="¿Es regular?"
        valor={regular}
        onChange={setRegular}
        opciones={[
          { valor: 'si', texto: 'Sí', color: 'var(--color-ciclo)' },
          { valor: 'no', texto: 'Varía bastante', color: 'var(--color-ciclo)' },
          { valor: 'nose', texto: 'No sé', color: 'var(--color-ciclo)' },
        ]}
      />
      <Selector label="Anticonceptivo" id="anticonceptivo" value={anti} onChange={(e) => setAnti(e.target.value as Anticonceptivo)} ayuda="Con uno hormonal no mostramos fases (no hay ovulación).">
        {ANTICONCEPTIVOS.map((a) => (
          <option key={a.valor} value={a.valor}>
            {a.texto}
          </option>
        ))}
      </Selector>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">¿Alguna condición? (opcional)</legend>
        <div className="flex flex-wrap gap-2">
          {CONDICIONES.map((c) => {
            const activo = condiciones.includes(c.valor)
            return (
              <button
                key={c.valor}
                type="button"
                aria-pressed={activo}
                onClick={() => setCondiciones((l) => (activo ? l.filter((x) => x !== c.valor) : [...l, c.valor]))}
                className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${activo ? 'border-transparent bg-ciclo text-white' : 'border-borde bg-superficie'}`}
              >
                {c.texto}
              </button>
            )
          })}
        </div>
      </fieldset>
      <label className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-fondo px-3 py-2">
        <span>
          <span className="block font-semibold">Avisame 2 días antes</span>
          <span className="text-sm text-texto-2">Una notificación antes del período previsto</span>
        </span>
        <input type="checkbox" role="switch" className="h-6 w-6 accent-ciclo" checked={aviso} onChange={(e) => setAviso(e.target.checked)} />
      </label>
      {!perfil && (
        <div className="rounded-xl border border-ciclo/30 bg-superficie p-3">
          <Opciones
            label="¿Qué querés que vea tu entrenador?"
            valor={compartir}
            onChange={setCompartir}
            opciones={[
              { valor: 'fase', texto: 'Fase y día', color: 'var(--color-ciclo)' },
              { valor: 'sintomas', texto: 'Fase y síntomas', color: 'var(--color-ciclo)' },
              { valor: 'nada', texto: 'Nada', color: 'var(--color-ciclo)' },
            ]}
          />
          <p className="mt-2 text-sm text-texto-2">
            Con tu fase, tu entrenador puede organizar las sesiones fuertes y suaves de tu semana. Nunca ve tu anticonceptivo ni tus condiciones, y lo podés cambiar cuando quieras en Ajustes.
          </p>
        </div>
      )}
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar} className="!bg-ciclo text-white hover:!bg-ciclo/90">
        {guardado ? '✓ Guardado' : perfil ? 'Guardar cambios' : 'Empezar'}
      </Boton>
    </div>
  )
}

function Registros({ alumnoId, registros, onCambio }: { alumnoId: string; registros: RegistroCiclo[]; onCambio: () => void }) {
  const hoy = hoyPY()
  const [editando, setEditando] = useState<string | null>(null)
  const [inicio, setInicio] = useState('')
  const [fin, setFin] = useState('')
  const [nueva, setNueva] = useState('')
  const [error, setError] = useState('')

  async function guardar(r: RegistroCiclo) {
    setError('')
    if (!inicio || inicio > hoy) return setError('Elegí una fecha de inicio válida (no futura).')
    if (fin && (fin < inicio || fin > hoy)) return setError('El fin tiene que ser después del inicio y no futuro.')
    const { error } = await supabase.from('ciclos_menstruales').update({ fecha_inicio: inicio, fecha_fin: fin || null }).eq('id', r.id)
    if (error) return setError(mensajeError(error))
    setEditando(null)
    onCambio()
  }
  async function borrar(r: RegistroCiclo) {
    if (!confirm(`¿Borrar el período del ${formatoFecha(r.fecha_inicio)}?`)) return
    await supabase.from('ciclos_menstruales').delete().eq('id', r.id)
    onCambio()
  }
  async function agregar() {
    setError('')
    if (!nueva || nueva > hoy) return setError('Elegí una fecha válida (no futura).')
    const { error } = await supabase.from('ciclos_menstruales').insert({ alumno_id: alumnoId, fecha_inicio: nueva })
    if (error) return setError(error.code === '23505' ? 'Ya hay un período ese día.' : mensajeError(error))
    setNueva('')
    onCambio()
  }

  const campo = 'min-h-11 rounded-xl border border-borde bg-superficie px-2 text-tinta'
  return (
    <Tarjeta>
      <Titulo>Mis períodos ({registros.length})</Titulo>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Agregar uno pasado
          <input type="date" className={campo} max={hoy} value={nueva} onChange={(e) => setNueva(e.target.value)} />
        </label>
        <Boton variante="borde" onClick={agregar}>
          Agregar
        </Boton>
      </div>
      <MensajeError>{error}</MensajeError>
      <ul className="mt-2 flex flex-col divide-y divide-borde text-sm">
        {registros.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            {editando === r.id ? (
              <>
                <span className="flex flex-wrap gap-2">
                  <input type="date" aria-label="Inicio" className={campo} value={inicio} max={hoy} onChange={(e) => setInicio(e.target.value)} />
                  <input type="date" aria-label="Fin" className={campo} value={fin} max={hoy} onChange={(e) => setFin(e.target.value)} />
                </span>
                <span className="flex gap-1">
                  <Boton variante="borde" onClick={() => setEditando(null)}>
                    Cancelar
                  </Boton>
                  <Boton onClick={() => guardar(r)}>Guardar</Boton>
                </span>
              </>
            ) : (
              <>
                <span>
                  <span className="font-semibold">
                    {formatoFecha(r.fecha_inicio)}/{r.fecha_inicio.slice(2, 4)}
                  </span>
                  {r.fecha_fin ? ` → ${formatoFecha(r.fecha_fin)} (${diasEntre(r.fecha_inicio, r.fecha_fin) + 1} días)` : ''}
                  {registros[i + 1] && <span className="text-texto-2"> · ciclo de {diasEntre(registros[i + 1].fecha_inicio, r.fecha_inicio)} días</span>}
                </span>
                <span className="flex gap-1">
                  <Boton variante="texto" onClick={() => (setEditando(r.id), setInicio(r.fecha_inicio), setFin(r.fecha_fin ?? ''))}>
                    Corregir
                  </Boton>
                  <Boton variante="texto" onClick={() => borrar(r)}>
                    Borrar
                  </Boton>
                </span>
              </>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}
