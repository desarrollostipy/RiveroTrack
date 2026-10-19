import { Suspense, type ReactNode } from 'react'
import { pantalla, useActualizarAlNavegar } from './lib/version'
import { Navigate, Route, Routes } from 'react-router'
import { useSesion } from './lib/sesion'
import { configFaltante } from './lib/supabase'
import { MiAlumnoProvider, useMiAlumno } from './lib/alumno'
import { useNoLeidos } from './lib/chat'
import { ConPestanas, type Pestana } from './components/ConPestanas'
import { Boton, Cargando, Tarjeta } from './components/ui'
import { IconoAlumnos, IconoCarreras, IconoChat, IconoCuentas, IconoEvolucion, IconoHoy, IconoPlanes, IconoSemana } from './components/Iconos'
import Ingreso from './pages/Ingreso'
import PrimerUso from './pages/PrimerUso'
import CambiarPin from './pages/CambiarPin'
import Registro from './pages/Registro'
const Solicitudes = pantalla(() => import('./pages/entrenador/Solicitudes'))
// Cada pantalla se descarga recién cuando se abre: la primera carga es más liviana.
const Alumnos = pantalla(() => import('./pages/entrenador/Alumnos'))
const FichaAlumno = pantalla(() => import('./pages/entrenador/FichaAlumno'))
const AlumnoForm = pantalla(() => import('./pages/entrenador/AlumnoForm'))
const EditorPlan = pantalla(() => import('./pages/entrenador/EditorPlan'))
const EvaluarSesion = pantalla(() => import('./pages/entrenador/EvaluarSesion'))
const Planes = pantalla(() => import('./pages/entrenador/Planes'))
const Cuentas = pantalla(() => import('./pages/entrenador/Cuentas'))
const Evolucion = pantalla(() => import('./pages/entrenador/Evolucion'))
const CompetenciasEntrenador = pantalla(() => import('./pages/entrenador/CompetenciasEntrenador'))
const Hoy = pantalla(() => import('./pages/alumno/Hoy'))
const MiSemana = pantalla(() => import('./pages/alumno/MiSemana'))
const Progreso = pantalla(() => import('./pages/alumno/Progreso'))
const RegistrarSesion = pantalla(() => import('./pages/alumno/RegistrarSesion'))
const Carreras = pantalla(() => import('./pages/alumno/Carreras'))
const ChatAlumno = pantalla(() => import('./pages/alumno/ChatAlumno'))
const Mensajes = pantalla(() => import('./pages/entrenador/Mensajes'))
const ChatEntrenador = pantalla(() => import('./pages/entrenador/ChatEntrenador'))
const Perfil = pantalla(() => import('./pages/Perfil'))
const Calculadora = pantalla(() => import('./pages/Calculadora'))
const Herramientas = pantalla(() => import('./pages/entrenador/Herramientas'))
const Anuncios = pantalla(() => import('./pages/entrenador/Anuncios'))
const Grupos = pantalla(() => import('./pages/entrenador/Grupos'))
const Plantillas = pantalla(() => import('./pages/entrenador/Plantillas'))
const Asistencia = pantalla(() => import('./pages/entrenador/Asistencia'))
const TomarAsistencia = pantalla(() => import('./pages/entrenador/Asistencia').then((m) => ({ default: m.TomarAsistencia })))

const pestanasEntrenador = (chat: number): Pestana[] => [
  { a: '/alumnos', texto: 'Alumnos', icono: <IconoAlumnos /> },
  { a: '/planes', texto: 'Planes', icono: <IconoPlanes /> },
  { a: '/mensajes', texto: 'Chat', icono: <IconoChat />, aviso: chat },
  { a: '/cuentas', texto: 'Cuentas', icono: <IconoCuentas /> },
  { a: '/evolucion', texto: 'Evolución', icono: <IconoEvolucion /> },
]

const pestanasAlumno = (chat: number): Pestana[] => [
  { a: '/hoy', texto: 'Hoy', icono: <IconoHoy /> },
  { a: '/semana', texto: 'Semana', icono: <IconoSemana /> },
  { a: '/chat', texto: 'Chat', icono: <IconoChat />, aviso: chat },
  { a: '/carreras', texto: 'Carreras', icono: <IconoCarreras /> },
  { a: '/progreso', texto: 'Progreso', icono: <IconoEvolucion /> },
]
export default function App() {
  const { cargando, session, perfil, salir } = useSesion()
  useActualizarAlNavegar()

  if (configFaltante) {
    return (
      <Aviso titulo="Falta configurar Supabase">
        Revisá VITE_SUPABASE_URL (tiene que ser https://….supabase.co) y VITE_SUPABASE_PUBLISHABLE_KEY en Netlify, y volvé a publicar con Trigger
        deploy.
      </Aviso>
    )
  }

  if (cargando) return <Cargando pantalla />

  if (!session) {
    return (
      <Routes>
        <Route path="/primer-uso" element={<PrimerUso />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="*" element={<Ingreso />} />
      </Routes>
    )
  }

  if (!perfil) {
    return (
      <Aviso titulo="Tu usuario no tiene perfil">
        Pedile a tu entrenador que revise tu acceso.
        <Boton variante="borde" onClick={salir} className="mt-4 w-full">
          Salir
        </Boton>
      </Aviso>
    )
  }

  if (perfil.debe_cambiar_clave) return <CambiarPin />

  if (perfil.rol === 'entrenador') return <RutasEntrenador miId={perfil.id} />

  return (
    <MiAlumnoProvider>
      <RutasAlumno miId={perfil.id} />
    </MiAlumnoProvider>
  )
}

function RutasEntrenador({ miId }: { miId: string }) {
  const { total } = useNoLeidos(miId)
  return (
    <Suspense fallback={<Cargando pantalla />}>
      <Routes>
        <Route element={<ConPestanas pestanas={pestanasEntrenador(total)} />}>
          <Route path="/alumnos" element={<Alumnos />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/mensajes" element={<Mensajes />} />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/evolucion" element={<Evolucion />} />
        </Route>
        <Route path="/alumnos/nuevo" element={<AlumnoForm />} />
        <Route path="/alumnos/:id" element={<FichaAlumno />} />
        <Route path="/alumnos/:id/editar" element={<AlumnoForm />} />
        <Route path="/alumnos/:id/plan" element={<EditorPlan />} />
        <Route path="/evaluar/:sesionId" element={<EvaluarSesion />} />
        <Route path="/solicitudes" element={<Solicitudes />} />
        <Route path="/competencias" element={<CompetenciasEntrenador />} />
        <Route path="/chat/:alumnoId" element={<ChatEntrenador />} />
        <Route path="/herramientas" element={<Herramientas />} />
        <Route path="/anuncios" element={<Anuncios />} />
        <Route path="/grupos" element={<Grupos />} />
        <Route path="/plantillas" element={<Plantillas />} />
        <Route path="/asistencia" element={<Asistencia />} />
        <Route path="/asistencia/:id" element={<TomarAsistencia />} />
        <Route path="/calculadora" element={<Calculadora />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/alumnos" replace />} />
      </Routes>
    </Suspense>
  )
}

function RutasAlumno({ miId }: { miId: string }) {
  const { alumno } = useMiAlumno()
  const { total } = useNoLeidos(miId, alumno.id)
  return (
    <Suspense fallback={<Cargando pantalla />}>
      <Routes>
        <Route element={<ConPestanas pestanas={pestanasAlumno(total)} />}>
          <Route path="/hoy" element={<Hoy />} />
          <Route path="/semana" element={<MiSemana />} />
          <Route path="/chat" element={<ChatAlumno />} />
          <Route path="/carreras" element={<Carreras />} />
          <Route path="/progreso" element={<Progreso />} />
        </Route>
        <Route path="/registrar/:sesionId" element={<RegistrarSesion />} />
        <Route path="/calculadora" element={<Calculadora />} />
        <Route path="/perfil" element={<Perfil />} />
        <Route path="*" element={<Navigate to="/hoy" replace />} />
      </Routes>
    </Suspense>
  )
}
function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm items-center px-4">
      <Tarjeta className="w-full">
        <h1 className="font-titulo text-xl font-extrabold">{titulo}</h1>
        <div className="mt-2 text-texto-2">{children}</div>
      </Tarjeta>
    </main>
  )
}
