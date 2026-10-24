import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { mensajeError } from '../../lib/consultas'
import { notificar } from '../../lib/push'
import { Link } from 'react-router'
import { hoyPY } from '../../lib/fechas'
import { leerDuracion, leerNumero } from '../../lib/formato'
import type { Competencia } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { DetalleCompetencia, FormResultado, OpcionesDistancia } from '../../components/Competencias'
import { EventosAlumno } from '../../components/comunidad/Eventos'
import { BotonCompartir, imagenDeCarrera } from '../../components/Compartir'
import { AreaTexto, Boton, Campo, Cargando, Hoja, MensajeError, MensajeOk, Titulo, Vacio } from '../../components/ui'

// Las competencias del alumno: proponer, ver si el profe la aprobó,
// cargar el resultado y ver el historial.
export default function Carreras() {
  const { alumno } = useMiAlumno()
  const hoy = hoyPY()
  const [lista, setLista] = useState<Competencia[] | null>(null)
  const [proponiendo, setProponiendo] = useState(false)
  const [resultadoDe, setResultadoDe] = useState<string | null>(null)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('competencias').select('*').eq('alumno_id', alumno.id).order('fecha')
    setLista((data ?? []) as Competencia[])
  }, [alumno.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function retirar(c: Competencia) {
    if (!confirm(`¿Retirar la propuesta "${c.nombre}"?`)) return
    await supabase.from('competencias').delete().eq('id', c.id)
    cargar()
  }

  // El día de la carrera ya aparece en Resultados para cargar el tiempo apenas termina.
  const proximas = (lista ?? []).filter((c) => c.fecha > hoy || (c.fecha === hoy && c.estado !== 'aprobada'))
  const pasadas = (lista ?? []).filter((c) => c.fecha <= hoy && c.estado === 'aprobada').reverse()

  return (
    <Pantalla
      titulo="Carreras"
      subtitulo="Tus competencias y resultados"
      derecha={
        <div className="flex gap-2">
          <Link to="/calculadora" aria-label="Calculadora de ritmos" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-borde bg-superficie text-xl">
            📊
          </Link>
          <Boton onClick={() => setProponiendo(true)}>+ Proponer</Boton>
        </div>
      }
    >
      <MensajeOk>{aviso}</MensajeOk>
      <EventosAlumno alumnoId={alumno.id} />
      {lista === null && <Cargando />}

      {lista && (
        <>
          <Titulo>Próximas</Titulo>
          {proximas.length === 0 && (
            <Vacio>
              ¿Querés correr alguna carrera? Tocá <strong>+ Proponer</strong> y tu entrenador te dice si la podés correr.
            </Vacio>
          )}
          {proximas.map((c) => (
            <DetalleCompetencia key={c.id} c={c}>
              {c.estado === 'aprobada' && (
                <Link to={`/carrera/${c.id}`} className="flex min-h-11 items-center justify-center rounded-xl bg-azul font-semibold text-white">
                  🏁 Modo carrera
                </Link>
              )}
              {c.estado === 'propuesta' && (
                <Boton variante="texto" className="self-start" onClick={() => retirar(c)}>
                  Retirar propuesta
                </Boton>
              )}
            </DetalleCompetencia>
          ))}

          <Titulo>Resultados</Titulo>
          {pasadas.length === 0 && <Vacio>Acá van a quedar tus carreras con sus resultados.</Vacio>}
          {pasadas.map((c) => (
            <DetalleCompetencia key={c.id} c={c}>
              {c.fecha === hoy && !c.resultado_tiempo_seg && resultadoDe !== c.id && (
                <Link to={`/carrera/${c.id}`} className="flex min-h-11 items-center justify-center rounded-xl border border-azul font-semibold text-azul">
                  🏁 Modo carrera
                </Link>
              )}
              {resultadoDe === c.id ? (
                <FormResultado
                  c={c}
                  onCancelar={() => setResultadoDe(null)}
                  onListo={() => (setResultadoDe(null), setAviso('¡Resultado guardado! Compartilo con tu foto 📸'), cargar())}
                />
              ) : c.resultado_tiempo_seg ? (
                <div className="flex flex-wrap items-center gap-2">
                  <BotonCompartir
                    permitirFoto
                    variante="primario"
                    etiqueta="📸 Compartir mi carrera"
                    nombreArchivo={`carrera-${c.fecha}.png`}
                    texto={`🏁 ${c.nombre} #RiveroTrack`}
                    generar={(d) => imagenDeCarrera(c, alumno.nombre, d)}
                  />
                  <Boton variante="texto" onClick={() => setResultadoDe(c.id)}>
                    Editar resultado
                  </Boton>
                </div>
              ) : (
                <Boton className="self-start" onClick={() => setResultadoDe(c.id)}>
                  ⏱️ Cargar mi resultado
                </Boton>
              )}
            </DetalleCompetencia>
          ))}
        </>
      )}

      <Proponer abierta={proponiendo} onCerrar={() => setProponiendo(false)} onListo={() => (setAviso('Propuesta enviada. Tu entrenador te va a responder acá.'), cargar())} />
    </Pantalla>
  )
}

function Proponer({ abierta, onCerrar, onListo }: { abierta: boolean; onCerrar: () => void; onListo: () => void }) {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [km, setKm] = useState('')
  const [lugar, setLugar] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState('')

  async function enviar() {
    setError('')
    if (!nombre.trim() || !fecha) return setError('Completá el nombre y la fecha.')
    if (fecha < hoyPY()) return setError('La fecha ya pasó.')
    const { data: nuevaId, error } = await supabase.rpc('proponer_competencia', {
      p_nombre: nombre,
      p_fecha: fecha,
      p_distancia_km: leerNumero(km),
      p_tiempo_objetivo_seg: objetivo ? leerDuracion(objetivo) : null,
      p_lugar: lugar,
      p_comentario: comentario,
    })
    if (error) return setError(mensajeError(error))
    if (nuevaId) notificar({ tipo: 'competencia', competencia_id: nuevaId as string })
    setNombre('')
    setFecha('')
    setKm('')
    setLugar('')
    setObjetivo('')
    setComentario('')
    onCerrar()
    onListo()
  }

  return (
    <Hoja titulo="Proponer una competencia" abierta={abierta} onCerrar={onCerrar}>
      <p className="text-sm text-texto-2">Tu entrenador la revisa y te dice si la podés correr.</p>
      <Campo id="prop-nombre" label="Nombre de la carrera" placeholder="Ej: 10K Nocturna de Asunción" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      <Campo id="prop-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <div>
        <Campo id="prop-km" label="Distancia (km)" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
        <div className="mt-2">
          <OpcionesDistancia valor={km} onChange={setKm} />
        </div>
      </div>
      <Campo id="prop-lugar" label="Lugar (opcional)" placeholder="Ej: Costanera de Asunción" value={lugar} onChange={(e) => setLugar(e.target.value)} />
      <Campo id="prop-obj" label="Tiempo que te gustaría hacer (opcional)" placeholder="50:00" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
      <AreaTexto
        id="prop-com"
        label="Comentario para tu entrenador (opcional)"
        rows={2}
        placeholder="Ej: Es con mi grupo del trabajo, la quiero correr tranquilo."
        value={comentario}
        onChange={(e) => setComentario(e.target.value)}
      />
      <MensajeError>{error}</MensajeError>
      <Boton onClick={enviar}>Enviar propuesta</Boton>
    </Hoja>
  )
}
