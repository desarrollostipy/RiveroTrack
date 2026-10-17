import { Pantalla } from '../../components/Pantalla'
import { EnConstruccion } from '../../components/ui'

// Pantallas vacías de la Etapa 0. Cada una pasa a su propio archivo
// cuando se construye.

export function Planes() {
  return (
    <Pantalla titulo="Planes">
      <EnConstruccion etapa={1}>
        Editor del plan semanal: doble turno, rango de ritmo, duplicar semana anterior, borrador o publicado y
        copiar para WhatsApp.
      </EnConstruccion>
    </Pantalla>
  )
}

export function Cuentas() {
  return (
    <Pantalla titulo="Cuentas">
      <EnConstruccion etapa={1}>Cuotas del mes, vencidas, cobrado y registro de pagos.</EnConstruccion>
    </Pantalla>
  )
}

export function Evolucion() {
  return (
    <Pantalla titulo="Evolución">
      <EnConstruccion etapa={4}>Km planificados contra hechos, ritmo en fondos y alertas.</EnConstruccion>
    </Pantalla>
  )
}
