import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { mensajeError } from '../lib/consultas'
import { cuotasQueCubre } from '../lib/calculos'
import { hoyPY, nombreMes } from '../lib/fechas'
import { formatoGs, leerMonto, miles } from '../lib/formato'
import type { Cuota, Medio } from '../lib/tipos'
import { Boton, Campo, MensajeError, Opciones } from './ui'

/**
 * Registrar un pago. El monto viene precargado con lo adeudado y el pago
 * salda las cuotas pendientes más viejas que alcance a cubrir.
 */
export function FormPago({
  alumnoId,
  pendientes,
  montoSugerido,
  onListo,
  onCancelar,
}: {
  alumnoId: string
  pendientes: Cuota[]
  montoSugerido: number
  onListo: () => void
  onCancelar?: () => void
}) {
  const [monto, setMonto] = useState(montoSugerido ? miles(montoSugerido) : '')
  const [fecha, setFecha] = useState(hoyPY())
  const [medio, setMedio] = useState<Medio>('transferencia')
  const [referencia, setReferencia] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const valor = leerMonto(monto)
  const salda = cuotasQueCubre(pendientes, valor)

  async function confirmar() {
    setError('')
    if (valor <= 0) return setError('Ingresá el monto.')
    setGuardando(true)
    const { error } = await supabase.rpc('registrar_pago', {
      p_alumno_id: alumnoId,
      p_fecha: fecha,
      p_monto: valor,
      p_medio: medio,
      p_referencia: referencia.trim() || null,
      p_cuota_ids: salda.map((c) => c.id),
    })
    setGuardando(false)
    if (error) return setError(mensajeError(error))
    onListo()
  }

  return (
    <div className="flex flex-col gap-3">
      <Campo id="pago-monto" label="Monto (Gs.)" inputMode="numeric" value={monto} onChange={(e) => setMonto(miles(leerMonto(e.target.value)))} />
      <p className="-mt-1 text-sm text-texto-2">
        {salda.length
          ? `Salda: ${salda.map((c) => nombreMes(c.periodo)).join(', ')}`
          : pendientes.length
            ? `No alcanza para saldar una cuota completa (${formatoGs(pendientes[0].monto)}). Se registra igual como pago a cuenta.`
            : 'No hay cuotas pendientes: se registra como pago adelantado.'}
      </p>
      <Campo id="pago-fecha" label="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <Opciones
        label="Medio"
        valor={medio}
        onChange={setMedio}
        opciones={[
          { valor: 'transferencia', texto: 'Transferencia' },
          { valor: 'efectivo', texto: 'Efectivo' },
        ]}
      />
      <Campo id="pago-ref" label="Nº de comprobante o nota (opcional)" value={referencia} onChange={(e) => setReferencia(e.target.value)} />
      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        {onCancelar && (
          <Boton variante="borde" onClick={onCancelar} className="flex-1">
            Cancelar
          </Boton>
        )}
        <Boton onClick={confirmar} disabled={guardando} className="flex-1">
          {guardando ? 'Guardando…' : 'Confirmar pago'}
        </Boton>
      </div>
    </div>
  )
}
