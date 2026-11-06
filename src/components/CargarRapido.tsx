import { useState } from 'react'
import { Link } from 'react-router'
import { useMiAlumno } from '../lib/alumno'
import { cargarSemanas } from '../lib/consultas'
import { hoyPY, lunesDe } from '../lib/fechas'
import type { SesionCompleta } from '../lib/tipos'
import { FormExtra } from './ActividadesExtra'
import { useTipos } from './Semana'
import { Hoja } from './ui'

/** Botón "+" del centro del menú: registrar la sesión de hoy, una actividad extra o un resultado. */
export function CargarRapido() {
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const [abierta, setAbierta] = useState(false)
  const [extra, setExtra] = useState(false)
  const [deHoy, setDeHoy] = useState<SesionCompleta[] | null>(null)
  const hoy = hoyPY()

  function abrir() {
    setAbierta(true)
    navigator.vibrate?.(10)
    const lunes = lunesDe(hoy)
    cargarSemanas({ alumnoId: alumno.id, desde: lunes, hasta: lunes })
      .then((s) => setDeHoy((s[0]?.sesiones ?? []).filter((x) => x.fecha === hoy && x.tipo !== 'descanso')))
      .catch(() => setDeHoy([]))
  }

  const opcion = 'flex min-h-16 items-center gap-3 rounded-3xl border border-borde bg-superficie px-4 py-3 text-left font-semibold hover:border-azul/50'

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        aria-label="Cargar: sesión, actividad extra o resultado"
        className="boton-accion -my-3 flex h-14 w-14 items-center justify-center rounded-full text-3xl font-black ring-4 ring-fondo"
      >
        +
      </button>
      <Hoja titulo="¿Qué querés cargar?" abierta={abierta} onCerrar={() => setAbierta(false)}>
        {deHoy === null && <p className="text-sm text-texto-2">Buscando tu sesión de hoy…</p>}
        {deHoy?.map((s) => (
          <Link key={s.id} to={`/registrar/${s.id}`} onClick={() => setAbierta(false)} className={`${opcion} !border-transparent boton-accion`}>
            <span className="text-2xl" aria-hidden="true">
              ⚡
            </span>
            <span>
              <span className="block">{s.registro ? 'Editar' : 'Registrar'} la sesión de hoy</span>
              <span className="text-sm font-normal opacity-80">{s.resumen || tipo(s.tipo).nombre}</span>
            </span>
          </Link>
        ))}
        {deHoy?.length === 0 && <p className="rounded-2xl bg-superficie px-3 py-2 text-sm text-texto-2">Hoy no tenés sesión planificada.</p>}
        <button
          type="button"
          className={opcion}
          onClick={() => {
            setAbierta(false)
            setExtra(true)
          }}
        >
          <span className="text-2xl" aria-hidden="true">
            🏊
          </span>
          <span>
            <span className="block">Actividad extra</span>
            <span className="text-sm font-normal text-texto-2">Natación, bici, gimnasio…</span>
          </span>
        </button>
        <Link to="/carreras" onClick={() => setAbierta(false)} className={opcion}>
          <span className="text-2xl" aria-hidden="true">
            🏁
          </span>
          <span>
            <span className="block">Resultado de una carrera</span>
            <span className="text-sm font-normal text-texto-2">Tiempo, puesto y foto para compartir</span>
          </span>
        </Link>
      </Hoja>
      <FormExtra alumnoId={alumno.id} fecha={hoy} abierta={extra} onCerrar={() => setExtra(false)} onListo={() => setExtra(false)} />
    </>
  )
}
