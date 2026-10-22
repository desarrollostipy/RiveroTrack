import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/consultas'
import { nombreMes } from '../lib/fechas'
import { formatoFecha, formatoGs } from '../lib/formato'
import { notificar } from '../lib/push'
import { verComprobante, type Comprobante } from '../lib/cobros'
import type { Cuota } from '../lib/tipos'
import { Boton, MensajeError, Tarjeta, Titulo } from './ui'

type ConAlumno = Comprobante & { alumnos: { nombre: string } | { nombre: string }[] | null }
const nombreDe = (c: ConAlumno) => (Array.isArray(c.alumnos) ? c.alumnos[0]?.nombre : c.alumnos?.nombre) ?? 'Alumno'

export const ESTADO_COMPROBANTE = {
  pendiente: { texto: '⏳ En revisión', clase: 'bg-parcial/25 text-tinta' },
  aprobado: { texto: '✓ Aprobado', clase: 'bg-ok/15 text-ok' },
  rechazado: { texto: '✕ Rechazado', clase: 'bg-mal/10 text-mal' },
} as const

/** Botón que abre el comprobante (link temporal: el archivo es privado). */
export function VerArchivo({ ruta }: { ruta: string }) {
  const [abriendo, setAbriendo] = useState(false)
  async function abrir() {
    setAbriendo(true)
    const url = await verComprobante(ruta)
    setAbriendo(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  return (
    <Boton variante="borde" onClick={abrir} disabled={abriendo}>
      {abriendo ? 'Abriendo…' : '🧾 Ver comprobante'}
    </Boton>
  )
}

/** Comprobantes que esperan revisión del entrenador: aprobar (salda las cuotas) o rechazar con motivo. */
export function RevisarComprobantes({ onCambio }: { onCambio?: () => void }) {
  const [lista, setLista] = useState<ConAlumno[]>([])
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [error, setError] = useState('')
  const [trabajando, setTrabajando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('comprobantes_pago').select('*, alumnos(nombre)').eq('estado', 'pendiente').order('created_at')
    const l = (data ?? []) as ConAlumno[]
    setLista(l)
    const ids = l.flatMap((c) => c.cuota_ids)
    if (ids.length) {
      const { data: q } = await supabase.from('cuotas').select('*').in('id', ids)
      setCuotas((q ?? []) as Cuota[])
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function aprobar(c: ConAlumno) {
    setTrabajando(c.id)
    setError('')
    const { error } = await supabase.rpc('aprobar_comprobante', { p_id: c.id })
    setTrabajando(null)
    if (error) return setError(mensajeError(error, error.message))
    notificar({ tipo: 'comprobante_revisado', comprobante_id: c.id })
    cargar()
    onCambio?.()
  }

  async function rechazar(c: ConAlumno) {
    const motivo = prompt('¿Por qué lo rechazás? El alumno lo va a ver.', 'El monto no coincide')
    if (motivo === null) return
    setTrabajando(c.id)
    const { error } = await supabase.rpc('rechazar_comprobante', { p_id: c.id, p_motivo: motivo })
    setTrabajando(null)
    if (error) return setError(mensajeError(error, error.message))
    notificar({ tipo: 'comprobante_revisado', comprobante_id: c.id })
    cargar()
  }

  if (!lista.length) return null
  return (
    <Tarjeta className="border-2 border-azul">
      <Titulo>🧾 Comprobantes por revisar ({lista.length})</Titulo>
      <MensajeError>{error}</MensajeError>
      <ul className="flex flex-col gap-3">
        {lista.map((c) => {
          const meses = cuotas.filter((q) => c.cuota_ids.includes(q.id))
          const debe = meses.reduce((t, q) => t + q.monto, 0)
          return (
            <li key={c.id} className="rounded-2xl bg-fondo p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{nombreDe(c)}</p>
                  <p className="text-sm text-texto-2">
                    {meses.map((q) => nombreMes(q.periodo)).join(', ') || 'Cuotas'} · transferido el {formatoFecha(c.fecha)}
                    {c.referencia ? ` · ${c.referencia}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-right font-mono font-bold">{formatoGs(c.monto)}</p>
              </div>
              {debe > 0 && debe !== c.monto && <p className="mt-1 text-sm font-semibold text-[#9A6B00]">⚠️ Las cuotas suman {formatoGs(debe)}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div className="col-span-2 grid">
                  <VerArchivo ruta={c.archivo} />
                </div>
                <Boton variante="peligro" disabled={trabajando === c.id} onClick={() => rechazar(c)}>
                  Rechazar
                </Boton>
                <Boton disabled={trabajando === c.id} onClick={() => aprobar(c)}>
                  ✓ Aprobar
                </Boton>
              </div>
            </li>
          )
        })}
      </ul>
    </Tarjeta>
  )
}
