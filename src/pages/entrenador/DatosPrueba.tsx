import { useState } from 'react'
import { llamarFuncion } from '../../lib/api'
import { Boton, MensajeError, MensajeOk } from '../../components/ui'

const CANTIDAD = 8

// Carga o borra los 8 alumnos de ejemplo, sin usar la terminal.
export function DatosPrueba({ hayAlumnos, onCambio }: { hayAlumnos: boolean; onCambio: () => void }) {
  const [trabajando, setTrabajando] = useState('')
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function cargar() {
    setError('')
    setOk('')
    for (let i = 0; i < CANTIDAD; i++) {
      setTrabajando(`Cargando alumno ${i + 1} de ${CANTIDAD}…`)
      const r = await llamarFuncion<{ nombre: string }>('datos-prueba', { accion: 'cargar', indice: i })
      if (r.error) {
        setTrabajando('')
        setError(r.error)
        onCambio()
        return
      }
    }
    setTrabajando('')
    setOk('Listo: 8 alumnos de prueba cargados. Ingresan con CI 9000001 a 9000007 y PIN 123456.')
    onCambio()
  }

  async function limpiar() {
    if (!confirm('¿Borrar los 8 alumnos de prueba y todos sus datos? Los alumnos reales no se tocan.')) return
    setError('')
    setOk('')
    setTrabajando('Borrando datos de prueba…')
    const r = await llamarFuncion<{ alumnos: number }>('datos-prueba', { accion: 'limpiar' })
    setTrabajando('')
    if (r.error !== null) setError(r.error)
    else setOk(`Borrados ${r.datos.alumnos} alumnos de prueba.`)
    onCambio()
  }

  return (
    <details className="mt-4 rounded-2xl border border-dashed border-borde bg-superficie p-4 text-sm" open={!hayAlumnos}>
      <summary className="min-h-11 cursor-pointer content-center font-semibold text-texto-2">Datos de prueba</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-texto-2">
          8 alumnos de ejemplo con planes, sesiones, evaluaciones, cuotas y pagos, para probar todo sin cargar nada. Borralos antes de usar la
          app con alumnos reales.
        </p>
        {trabajando && <p role="status" className="font-semibold text-azul">{trabajando}</p>}
        <MensajeError>{error}</MensajeError>
        <MensajeOk>{ok}</MensajeOk>
        <div className="flex flex-wrap gap-2">
          <Boton variante="borde" onClick={cargar} disabled={!!trabajando}>
            Cargar datos de prueba
          </Boton>
          <Boton variante="peligro" onClick={limpiar} disabled={!!trabajando}>
            Borrar datos de prueba
          </Boton>
        </div>
      </div>
    </details>
  )
}
