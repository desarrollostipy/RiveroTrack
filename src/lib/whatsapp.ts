import { nombreMes } from './fechas'
import { formatoFecha, formatoGs } from './formato'
import type { Cuota } from './tipos'

// Link de WhatsApp con el mensaje ya escrito. Si no hay celular cargado,
// WhatsApp abre la lista de contactos para elegir a quién mandarlo.
export function linkWhatsApp(telefono: string | null | undefined, texto: string) {
  const digitos = (telefono ?? '').replace(/\D/g, '')
  // Paraguay: 0981 123 456 → 595981123456
  const numero = digitos.startsWith('595') ? digitos : digitos.startsWith('0') ? '595' + digitos.slice(1) : digitos ? '595' + digitos : ''
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

export function textoRecordatorioCuota(nombre: string, vencidas: Cuota[]) {
  const primer = nombre.split(' ')[0]
  const total = vencidas.reduce((t, c) => t + c.monto, 0)
  const meses = vencidas.map((c) => nombreMes(c.periodo).toLowerCase()).join(', ')
  const vence = vencidas[0] ? ` (venció el ${formatoFecha(vencidas[0].vencimiento)})` : ''
  return vencidas.length === 1
    ? `Hola ${primer}! 👋 Te recuerdo la cuota de ${meses} de Rivero Track & Field: ${formatoGs(total)}${vence}. ¡Gracias! 🏃`
    : `Hola ${primer}! 👋 Te recuerdo que tenés ${vencidas.length} cuotas pendientes en Rivero Track & Field (${meses}): ${formatoGs(total)} en total. ¡Gracias! 🏃`
}
