import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { mensajeError } from '../../../lib/consultas'
import { estaVencida } from '../../../lib/calculos'
import { diasEntre, haceDias, hoyPY, nombreMes, primerDiaMes, sumarDias, sumarMeses } from '../../../lib/fechas'
import { formatoFecha, formatoGs, leerMonto, miles } from '../../../lib/formato'
import type { Alumno, Cuota, Pago } from '../../../lib/tipos'
import { FormPago } from '../../../components/FormPago'
import { linkWhatsApp, textoRecordatorioCuota } from '../../../lib/whatsapp'
import { Boton, Campo, MensajeError, Tarjeta, Titulo, Vacio } from '../../../components/ui'

export function TabPagos({ alumno, cuotas, pagos, onCambio }: { alumno: Alumno; cuotas: Cuota[]; pagos: Pago[]; onCambio: () => void }) {
  const hoy = hoyPY()
  const [registrando, setRegistrando] = useState(false)
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState('')
  const pendientes = cuotas.filter((c) => c.estado === 'pendiente')
  const vencidas = pendientes.filter((c) => estaVencida(c, hoy))
  const sugerido = (vencidas.length ? vencidas : pendientes.slice(-1)).reduce((t, c) => t + c.monto, 0) || alumno.cuota_mensual
  const pagoPorId = Object.fromEntries(pagos.map((p) => [p.id, p]))

  // Próxima cuota que se va a generar (la del mes siguiente al último generado).
  const ultimoPeriodo = cuotas[0]?.periodo ?? primerDiaMes(hoy)
  const proximoPeriodo = cuotas.length ? sumarMeses(ultimoPeriodo, 1) : primerDiaMes(hoy)
  const proximoVence = sumarDias(proximoPeriodo, alumno.dia_vencimiento - 1)

  async function anular(c: Cuota) {
    if (!confirm(`¿Anular la cuota de ${nombreMes(c.periodo)}? Se borra y deja de figurar como deuda.`)) return
    const { error } = await supabase.from('cuotas').delete().eq('id', c.id)
    if (error) setError(mensajeError(error))
    onCambio()
  }

  async function anularPago(p: Pago) {
    if (!confirm(`¿Anular el pago de ${formatoGs(p.monto)} del ${formatoFecha(p.fecha)}? Las cuotas que saldaba vuelven a quedar pendientes.`)) return
    const { error } = await supabase.from('pagos').delete().eq('id', p.id)
    if (error) setError(mensajeError(error))
    onCambio()
  }

  return (
    <div className="flex flex-col gap-3">
      {!registrando ? (
        <div className="flex gap-2">
          {vencidas.length > 0 && (
            <a
              href={linkWhatsApp(alumno.telefono, textoRecordatorioCuota(alumno.nombre, vencidas))}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-ok bg-superficie font-semibold text-ok"
            >
              📲 Recordar por WhatsApp
            </a>
          )}
          <Boton className="flex-1" onClick={() => setRegistrando(true)}>
            Registrar pago
          </Boton>
        </div>
      ) : (
        <Tarjeta>
          <Titulo>Registrar pago</Titulo>
          <FormPago
            alumnoId={alumno.id}
            pendientes={pendientes}
            montoSugerido={sugerido}
            onCancelar={() => setRegistrando(false)}
            onListo={() => {
              setRegistrando(false)
              onCambio()
            }}
          />
        </Tarjeta>
      )}

      <Tarjeta>
        <Titulo accion={!editando && <Boton variante="texto" onClick={() => setEditando(true)}>Editar</Boton>}>Cuota</Titulo>
        {editando ? (
          <EditarCuota alumno={alumno} onListo={() => (setEditando(false), onCambio())} onCancelar={() => setEditando(false)} />
        ) : (
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-texto-2">Mensual</dt>
              <dd className="font-mono font-semibold">{formatoGs(alumno.cuota_mensual)}</dd>
            </div>
            <div>
              <dt className="text-texto-2">Vence el día</dt>
              <dd className="font-mono font-semibold">{alumno.dia_vencimiento}</dd>
            </div>
            <div>
              <dt className="text-texto-2">Próxima</dt>
              <dd className="font-mono font-semibold">{formatoFecha(proximoVence)}</dd>
            </div>
          </dl>
        )}
      </Tarjeta>

      <MensajeError>{error}</MensajeError>

      <Titulo>Historial</Titulo>
      {cuotas.length === 0 && <Vacio>Todavía no hay cuotas generadas.</Vacio>}
      <ul className="flex flex-col gap-2">
        {cuotas.map((c) => {
          const pago = c.pago_id ? pagoPorId[c.pago_id] : null
          const vencida = estaVencida(c, hoy)
          return (
            <li key={c.id} className="flex items-center justify-between gap-2 rounded-2xl border border-borde bg-superficie p-3">
              <div>
                <p className="font-semibold">
                  {nombreMes(c.periodo)} {c.periodo.slice(0, 4)}
                </p>
                <p className={`text-sm ${pago ? 'text-ok' : vencida ? 'text-mal' : 'text-texto-2'}`}>
                  {pago
                    ? `Pagada ${formatoFecha(pago.fecha)} · ${pago.medio === 'transferencia' ? 'Transferencia' : 'Efectivo'}`
                    : vencida
                      ? `Vencida ${haceDias(diasEntre(c.vencimiento, hoy))}`
                      : `Pendiente · vence ${formatoFecha(c.vencimiento)}`}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-mono text-sm font-semibold">{formatoGs(c.monto)}</span>
                {!pago && (
                  <Boton variante="texto" onClick={() => anular(c)} aria-label={`Anular cuota de ${nombreMes(c.periodo)}`}>
                    ✕
                  </Boton>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {pagos.length > 0 && (
        <details className="rounded-2xl border border-borde bg-superficie p-3 text-sm">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Pagos registrados ({pagos.length})</summary>
          <ul className="mt-2 flex flex-col divide-y divide-borde">
            {pagos.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {formatoFecha(p.fecha)} · {p.medio === 'transferencia' ? 'Transferencia' : 'Efectivo'}
                  {p.referencia ? ` · ${p.referencia}` : ''}
                </span>
                <span className="flex items-center gap-1">
                  <span className="font-mono font-semibold">{formatoGs(p.monto)}</span>
                  <Boton variante="texto" onClick={() => anularPago(p)} aria-label="Anular pago">
                    ✕
                  </Boton>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function EditarCuota({ alumno, onListo, onCancelar }: { alumno: Alumno; onListo: () => void; onCancelar: () => void }) {
  const [monto, setMonto] = useState(miles(alumno.cuota_mensual))
  const [dia, setDia] = useState(String(alumno.dia_vencimiento))
  const [error, setError] = useState('')

  async function guardar() {
    const d = Number(dia)
    if (!Number.isInteger(d) || d < 1 || d > 28) return setError('El día va de 1 a 28.')
    const { error } = await supabase.from('alumnos').update({ cuota_mensual: leerMonto(monto), dia_vencimiento: d }).eq('id', alumno.id)
    if (error) return setError(mensajeError(error))
    onListo()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo id="ec-monto" label="Monto (Gs.)" inputMode="numeric" value={monto} onChange={(e) => setMonto(miles(leerMonto(e.target.value)))} />
        <Campo id="ec-dia" label="Día (1 a 28)" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} />
      </div>
      <p className="text-sm text-texto-2">Se aplica desde la próxima cuota. Las ya generadas no cambian.</p>
      <MensajeError>{error}</MensajeError>
      <div className="flex gap-2">
        <Boton variante="borde" onClick={onCancelar} className="flex-1">
          Cancelar
        </Boton>
        <Boton onClick={guardar} className="flex-1">
          Guardar
        </Boton>
      </div>
    </div>
  )
}
