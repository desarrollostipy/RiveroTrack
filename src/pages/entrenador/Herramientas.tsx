import { Link } from 'react-router'
import { Pantalla } from '../../components/Pantalla'

const HERRAMIENTAS = [
  { a: '/agenda', icono: '📆', titulo: 'Agenda del día', texto: 'Quién entrena hoy y quién ya registró' },
  { a: '/alertas', icono: '🔔', titulo: 'Alertas', texto: 'Molestias, bienestar bajo, carga y cuotas' },
  { a: '/emergencias', icono: '🆘', titulo: 'Emergencias', texto: 'Contactos y datos médicos de todos' },
  { a: '/anuncios', icono: '📢', titulo: 'Anuncios', texto: 'Avisos para todo el grupo o para un grupo' },
  { a: '/asistencia', icono: '📍', titulo: 'Asistencia', texto: 'Quién vino a los entrenamientos grupales' },
  { a: '/grupos', icono: '👥', titulo: 'Grupos', texto: 'Principiantes, Grupo 21K… para planes y anuncios' },
  { a: '/plantillas', icono: '🧩', titulo: 'Plantillas de sesión', texto: 'Sesiones guardadas para reutilizar' },
  { a: '/competencias', icono: '🏁', titulo: 'Competencias', texto: 'Aprobar carreras y ver resultados' },
  { a: '/solicitudes', icono: '📝', titulo: 'Solicitudes de alta', texto: 'Alumnos que se registraron solos' },
  { a: '/calculadora', icono: '📊', titulo: 'Calculadora de ritmos', texto: 'Tiempos estimados y ritmos de entrenamiento' },
]

export default function Herramientas() {
  return (
    <Pantalla titulo="Herramientas" volver="/alumnos">
      <ul className="grid grid-cols-2 gap-2">
        {HERRAMIENTAS.map((h) => (
          <li key={h.a}>
            <Link to={h.a} className="flex h-full min-h-28 flex-col gap-1 rounded-2xl border border-borde bg-superficie p-3 hover:border-azul">
              <span className="text-3xl" aria-hidden="true">
                {h.icono}
              </span>
              <span className="font-semibold">{h.titulo}</span>
              <span className="text-xs text-texto-2">{h.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}
