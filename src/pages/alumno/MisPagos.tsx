import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useMiAlumno } from '../../lib/alumno'
import { mensajeError } from '../../lib/consultas'
import { hoyPY, nombreMes, sumarDias } from '../../lib/fechas'
import { formatoFecha, formatoGs, leerMonto, miles } from '../../lib/formato'
import { notificar } from '../../lib/push'
import { subirComprobante, type Comprobante } from '../../lib/cobros'
import type { Cuota } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { ESTADO_COMPROBANTE, VerArchivo } from '../../components/Comprobantes'
import { Boton, Campo, Cargando, Hoja, MensajeError, MensajeOk, Tarjeta, Titulo, Vacio } from '../../components/ui'

/** Mis pagos: cuotas pendientes, informar una transferencia con su comprobante e historial. */
export default function MisPagos() {
  const { alumno } = useMiAlumno()
  const hoy = hoyPY()
  const [cuotas, setCuotas] = useState<Cuota[] | null>(null)
  const [comprobantes, setComprobantes] = useState<Comprobante[]>([])
  const [abierta, setAbierta] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const [c, k] = await Promise.all([
      supabase.from('cuotas').select('*').eq('alumno_id', alumno.id).order('periodo', { ascending: false }).limit(24),
      supabase.from('comprobantes_pago').select('*').eq('alumno_id', alumno.id).order('created_at', { ascending: false }).limit(20),
    ])
    setCuotas((c.data ?? []) as Cuota[])
    setComprobantes((k.data ?? []) as Comprobante[])
  }, [alumno.id])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!cuotas) return <Cargando pantalla />
  // Una cuota con un comprobante en revisión no se puede volver a informar.
  const enRevision = new Set(comprobantes.filter((c) => c.estado === 'pendiente').flatMap((c) => c.cuota_ids))
  const pendientes = cuotas.filter((c) => c.estado === 'pendiente').reverse()
  const aInformar = pendientes.filter((c) => !enRevision.has(c.id))
  const deuda = pendientes.reduce((t, c) => t + c.monto, 0)

  async function retirar(c: Comprobante) {
    if (!confirm('¿Retirar este comprobante?')) return
    await supabase.from('comprobantes_pago').delete().eq('id', c.id)
    await supabase.storage.from('comprobantes').remove([c.archivo])
    cargar()
  }

  return (
    <Pantalla titulo="💳 Mis pagos" volver="/perfil">
      <MensajeOk>{aviso}</MensajeOk>
      <div className={`rounded-2xl p-4 ${deuda ? 'bg-mal text-white' : 'bg-ok/15 text-ok'}`}>
        <p className="text-sm opacity-90">{deuda ? 'Tenés pendiente' : 'Estás al día'}</p>
        <p className="font-titulo text-3xl font-extrabold">{deuda ? formatoGs(deuda) : '✓'}</p>
        {deuda > 0 && <p className="text-sm opacity-90">{pendientes.map((c) => nombreMes(c.periodo)).join(', ')}</p>}
      </div>

      {aInformar.length > 0 && (
        <Boton onClick={() => setAbierta(true)}>📤 Informar pago por transferencia</Boton>
      )}
      {pendientes.length > 0 && aInformar.length === 0 && <p className="text-center text-sm text-texto-2">Tu comprobante está en revisión. Te avisamos cuando lo apruebe tu entrenador.</p>}

      {comprobantes.length > 0 && (
        <Tarjeta>
          <Titulo>Comprobantes enviados</Titulo>
          <ul className="flex flex-col gap-2">
            {comprobantes.map((c) => (
              <li key={c.id} className="rounded-xl bg-fondo p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-semibold">{formatoGs(c.monto)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${ESTADO_COMPROBANTE[c.estado].clase}`}>{ESTADO_COMPROBANTE[c.estado].texto}</span>
                </div>
                <p className="text-sm text-texto-2">
                  {cuotas
                    .filter((q) => c.cuota_ids.includes(q.id))
                    .map((q) => nombreMes(q.periodo))
                    .join(', ')}{' '}
                  · enviado el {formatoFecha(c.created_at.slice(0, 10))}
                </p>
                {c.estado === 'rechazado' && c.motivo && <p className="mt-1 text-sm font-semibold text-mal">Motivo: {c.motivo}</p>}
                <div className="mt-2 flex gap-2">
                  <VerArchivo ruta={c.archivo} />
                  {c.estado === 'pendiente' && (
                    <Boton variante="texto" onClick={() => retirar(c)}>
                      Retirar
                    </Boton>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}

      <Tarjeta>
        <Titulo>Mis cuotas</Titulo>
        {cuotas.length === 0 ? (
          <Vacio>Todavía no hay cuotas.</Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {cuotas.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <b>{nombreMes(c.periodo)}</b> {c.periodo.slice(0, 4)}
                  <span className="block text-texto-2">vence {formatoFecha(c.vencimiento)}</span>
                </span>
                <span className="text-right">
                  <span className="block font-mono">{formatoGs(c.monto)}</span>
                  <span className={`text-xs font-bold ${c.estado === 'pagada' ? 'text-ok' : enRevision.has(c.id) ? 'text-[#9A6B00]' : c.vencimiento < hoy ? 'text-mal' : 'text-texto-2'}`}>
                    {c.estado === 'pagada' ? '✓ Pagada' : enRevision.has(c.id) ? 'En revisión' : c.vencimiento < hoy ? 'Vencida' : 'Pendiente'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <InformarPago
        alumnoId={alumno.id}
        cuotas={aInformar}
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        onListo={() => (setAviso('¡Listo! Tu entrenador va a revisar el comprobante.'), cargar())}
      />
    </Pantalla>
  )
}

function InformarPago({ alumnoId, cuotas, abierta, onCerrar, onListo }: { alumnoId: string; cuotas: Cuota[]; abierta: boolean; onCerrar: () => void; onListo: () => void }) {
  const hoy = hoyPY()
  const [elegidas, setElegidas] = useState<string[]>([])
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(hoy)
  const [referencia, setReferencia] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!abierta) return
    // Por defecto, la cuota más vieja.
    const primera = cuotas[0]
    setElegidas(primera ? [primera.id] : [])
    setMonto(primera ? miles(primera.monto) : '')
    setFecha(hoy)
    setReferencia('')
    setArchivo(null)
    setError('')
  }, [abierta, cuotas, hoy])

  function alternar(c: Cuota) {
    const nuevas = elegidas.includes(c.id) ? elegidas.filter((x) => x !== c.id) : [...elegidas, c.id]
    setElegidas(nuevas)
    setMonto(miles(cuotas.filter((q) => nuevas.includes(q.id)).reduce((t, q) => t + q.monto, 0)))
  }

  async function enviar() {
    setError('')
    const m = leerMonto(monto)
    if (!elegidas.length) return setError('Elegí qué cuota(s) pagaste.')
    if (!m || m <= 0) return setError('Escribí el monto transferido.')
    if (!archivo) return setError('Adjuntá la foto o el PDF del comprobante.')
    if (fecha > hoy || fecha < sumarDias(hoy, -90)) return setError('Revisá la fecha de la transferencia.')
    setEnviando(true)
    try {
      const ruta = await subirComprobante(archivo)
      const { data, error } = await supabase
        .from('comprobantes_pago')
        .insert({ alumno_id: alumnoId, cuota_ids: elegidas, monto: m, fecha, referencia: referencia.trim() || null, archivo: ruta })
        .select('id')
        .single()
      if (error) {
        await supabase.storage.from('comprobantes').remove([ruta])
        throw new Error(mensajeError(error, error.message))
      }
      notificar({ tipo: 'comprobante', comprobante_id: (data as { id: string }).id })
      onListo()
      onCerrar()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Hoja titulo="Informar pago" abierta={abierta} onCerrar={onCerrar}>
      <div>
        <p className="mb-1 text-sm font-semibold">¿Qué pagaste?</p>
        <ul className="flex flex-col gap-1">
          {cuotas.map((c) => (
            <li key={c.id}>
              <label className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-borde px-3">
                <span className="flex items-center gap-2">
                  <input type="checkbox" className="h-5 w-5 accent-[var(--color-azul)]" checked={elegidas.includes(c.id)} onChange={() => alternar(c)} />
                  {nombreMes(c.periodo)} {c.periodo.slice(0, 4)}
                </span>
                <span className="font-mono text-sm">{formatoGs(c.monto)}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo id="pg-monto" label="Monto transferido (Gs.)" inputMode="numeric" value={monto} onChange={(e) => setMonto(e.target.value)} />
        <Campo id="pg-fecha" type="date" label="Fecha" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} />
      </div>
      <Campo id="pg-ref" label="N° de operación (opcional)" value={referencia} maxLength={80} onChange={(e) => setReferencia(e.target.value)} />
      <div>
        <label htmlFor="pg-archivo" className="mb-1 block text-sm font-semibold">
          Comprobante (foto o PDF)
        </label>
        <input
          id="pg-archivo"
          type="file"
          accept="image/*,application/pdf"
          className="block w-full rounded-xl border border-borde bg-superficie p-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-azul file:px-3 file:py-2 file:font-semibold file:text-white"
          onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
        />
        <p className="mt-1 text-xs text-texto-2">Solo lo ven vos y tu entrenador.</p>
      </div>
      <MensajeError>{error}</MensajeError>
      <Boton onClick={enviar} disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar comprobante'}
      </Boton>
    </Hoja>
  )
}
