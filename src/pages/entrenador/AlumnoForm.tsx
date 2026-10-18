import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { supabase } from '../../lib/supabase'
import { cargarAlumno, mensajeError } from '../../lib/consultas'
import { leerMonto, leerNumero, miles } from '../../lib/formato'
import { gestionarAcceso } from '../../lib/api'
import { esCiValida, limpiarCi } from '../../lib/acceso'
import type { EstadoAcceso } from './ficha/Acceso'
import type { Alumno, Nivel } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { AreaTexto, Boton, Campo, Cargando, MensajeError, Opciones } from '../../components/ui'

// Alta (/alumnos/nuevo) y edición (/alumnos/:id/editar) de la ficha.
export default function AlumnoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const editando = !!id
  const [listo, setListo] = useState(!editando)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [sexo, setSexo] = useState<'F' | 'M' | null>(null)
  const [nivel, setNivel] = useState<Nivel>('principiante')
  const [nacimiento, setNacimiento] = useState('')
  const [objetivo, setObjetivo] = useState('')
  const [fcMax, setFcMax] = useState('')
  const [altura, setAltura] = useState('')
  const [cuota, setCuota] = useState('')
  const [dia, setDia] = useState('')
  const [activo, setActivo] = useState(true)
  const [notas, setNotas] = useState('')
  const [tieneAcceso, setTieneAcceso] = useState(false)
  const [ci, setCi] = useState('')
  const [darAcceso, setDarAcceso] = useState(true)

  useEffect(() => {
    if (editando) {
      Promise.all([cargarAlumno(id!), supabase.from('notas_privadas').select('notas').eq('alumno_id', id!).maybeSingle()]).then(([a, n]) => {
        if (!a) return setError('No se encontró el alumno.')
        setNombre(a.nombre)
        setSexo(a.sexo)
        setNivel(a.nivel)
        setNacimiento(a.fecha_nacimiento ?? '')
        setObjetivo(a.objetivo ?? '')
        setFcMax(a.fc_max ? String(a.fc_max) : '')
        setAltura(a.altura_cm ? String(a.altura_cm) : '')
        setCuota(miles(a.cuota_mensual))
        setDia(String(a.dia_vencimiento))
        setActivo(a.activo)
        setTieneAcceso(!!a.profile_id)
        setCi(a.ci ?? '')
        setDarAcceso(false)
        setNotas(n.data?.notas ?? '')
        setListo(true)
      })
    } else {
      supabase
        .from('config_cuotas')
        .select('*')
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCuota(miles(data.monto_default))
            setDia(String(data.dia_vencimiento_default))
          }
        })
    }
  }, [editando, id])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) return setError('Ingresá el nombre.')
    if (!sexo) return setError('Elegí el sexo.')
    const diaN = Number(dia)
    if (!Number.isInteger(diaN) || diaN < 1 || diaN > 28) return setError('El día de vencimiento va de 1 a 28.')
    const fc = leerNumero(fcMax)
    const alt = leerNumero(altura)
    if (fc !== null && (fc < 100 || fc > 230)) return setError('La FC máxima va de 100 a 230.')
    if (alt !== null && (alt < 100 || alt > 230)) return setError('La altura va de 100 a 230 cm.')
    if (ci && !esCiValida(ci)) return setError('La CI tiene que ser solo números.')

    const datos = {
      nombre: nombre.trim(),
      sexo,
      nivel,
      fecha_nacimiento: nacimiento || null,
      objetivo: objetivo.trim() || null,
      fc_max: fc,
      altura_cm: alt,
      cuota_mensual: leerMonto(cuota),
      dia_vencimiento: diaN,
      activo,
      // La CI no se cambia si ya tiene acceso (es su usuario para ingresar).
      ...(tieneAcceso ? {} : { ci: limpiarCi(ci) || null }),
      ...(sexo === 'M' ? { comparte_ciclo: false } : {}),
    }

    setGuardando(true)
    try {
      let alumnoId = id
      if (editando) {
        const { error } = await supabase.from('alumnos').update(datos).eq('id', id!)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('alumnos').insert(datos).select('id').single()
        if (error) throw error
        alumnoId = (data as Pick<Alumno, 'id'>).id
      }
      const { error: errNotas } = await supabase.from('notas_privadas').upsert({ alumno_id: alumnoId, notas: notas.trim() })
      if (errNotas) throw errNotas

      // Acceso a la app: CI + PIN temporal aleatorio (se muestra en la ficha).
      let estado: EstadoAcceso | undefined
      if (ci && !tieneAcceso && darAcceso) {
        const r = await gestionarAcceso<{ pin: string }>({ accion: 'crear-acceso', alumno_id: alumnoId!, ci: limpiarCi(ci) })
        estado = r.error !== null ? { ci: limpiarCi(ci), errorAcceso: `El alumno se guardó, pero no se pudo crear el acceso: ${r.error}` } : { pin: r.datos.pin, ci: limpiarCi(ci) }
      }
      navigate(`/alumnos/${alumnoId}`, { replace: true, state: estado })
    } catch (err) {
      setError(mensajeError(err))
      setGuardando(false)
    }
  }

  if (!listo) return error ? <MensajeError>{error}</MensajeError> : <Cargando pantalla />

  return (
    <Pantalla titulo={editando ? 'Editar alumno' : 'Nuevo alumno'} volver={editando ? `/alumnos/${id}` : '/alumnos'}>
      <form onSubmit={guardar} noValidate className="flex flex-col gap-4">
        <Campo id="nombre" label="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
        <Opciones
          label="Sexo"
          valor={sexo}
          onChange={setSexo}
          opciones={[
            { valor: 'F', texto: 'Femenino' },
            { valor: 'M', texto: 'Masculino' },
          ]}
        />
        <Opciones
          label="Nivel"
          valor={nivel}
          onChange={setNivel}
          opciones={[
            { valor: 'principiante', texto: 'Principiante' },
            { valor: 'intermedio', texto: 'Intermedio' },
            { valor: 'avanzado', texto: 'Avanzado' },
          ]}
        />
        <Campo id="objetivo" label="Objetivo" placeholder="Ej: Media maratón sub 1:45" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
        <Campo id="nacimiento" label="Fecha de nacimiento" type="date" value={nacimiento} onChange={(e) => setNacimiento(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Campo id="altura" label="Altura (cm)" inputMode="numeric" value={altura} onChange={(e) => setAltura(e.target.value.replace(/\D/g, ''))} />
          <Campo id="fcmax" label="FC máxima" inputMode="numeric" value={fcMax} onChange={(e) => setFcMax(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo
            id="cuota"
            label="Cuota mensual (Gs.)"
            inputMode="numeric"
            value={cuota}
            onChange={(e) => setCuota(miles(leerMonto(e.target.value)))}
            ayuda={editando ? 'Se aplica desde la próxima cuota' : undefined}
          />
          <Campo id="dia" label="Vence el día (1 a 28)" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} />
        </div>
        {tieneAcceso ? (
          <p className="text-sm">
            <span className="text-texto-2">Número de CI:</span> <strong className="font-mono">{ci || '—'}</strong>{' '}
            <span className="text-texto-2">(es su usuario para ingresar; no se cambia acá)</span>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Campo
              id="ci-ingreso"
              label="Número de CI"
              inputMode="numeric"
              value={ci}
              onChange={(e) => setCi(e.target.value.replace(/\D/g, ''))}
              ayuda="No puede haber dos alumnos con la misma CI."
            />
            {ci && (
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" className="h-5 w-5" checked={darAcceso} onChange={(e) => setDarAcceso(e.target.checked)} />
                <span>Crear su acceso a la app ahora (PIN temporal)</span>
              </label>
            )}
          </div>
        )}
        <AreaTexto id="notas" label="Notas privadas (solo las ves vos)" value={notas} onChange={(e) => setNotas(e.target.value)} />
        {editando && (
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" className="h-5 w-5" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <span>
              Activo <span className="text-sm text-texto-2">(si lo desactivás, no se le generan más cuotas)</span>
            </span>
          </label>
        )}
        <MensajeError>{error}</MensajeError>
        <Boton type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Dar de alta'}
        </Boton>
      </form>
    </Pantalla>
  )
}
