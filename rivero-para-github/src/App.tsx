import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { useSesion } from './lib/sesion'
import { configFaltante } from './lib/supabase'
import { ConPestanas, type Pestana } from './components/ConPestanas'
import { Boton, Cargando, Tarjeta } from './components/ui'
import { IconoAlumnos, IconoCuentas, IconoEvolucion, IconoHoy, IconoPlanes, IconoSemana } from './components/Iconos'
import Ingreso from './pages/Ingreso'
import PrimerUso from './pages/PrimerUso'
import CambiarPin from './pages/CambiarPin'
import Alumnos from './pages/entrenador/Alumnos'
import FichaAlumno from './pages/entrenador/FichaAlumno'
import { Cuentas, Evolucion, Planes } from './pages/entrenador/Secciones'
import { Hoy, MiSemana, Progreso } from './pages/alumno/Secciones'

const PESTANAS_ENTRENADOR: Pestana[] = [
  { a: '/alumnos', texto: 'Alumnos', icono: <IconoAlumnos /> },
  { a: '/planes', texto: 'Planes', icono: <IconoPlanes /> },
  { a: '/cuentas', texto: 'Cuentas', icono: <IconoCuentas /> },
  { a: '/evolucion', texto: 'Evolución', icono: <IconoEvolucion /> },
]

const PESTANAS_ALUMNO: Pestana[] = [
  { a: '/hoy', texto: 'Hoy', icono: <IconoHoy /> },
  { a: '/semana', texto: 'Semana', icono: <IconoSemana /> },
  { a: '/progreso', texto: 'Progreso', icono: <IconoEvolucion /> },
]

export default function App() {
  const { cargando, session, perfil, salir } = useSesion()

  if (configFaltante) {
    return (
      <Aviso titulo="Falta configurar Supabase">
        Completá VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY (en el archivo .env o en Netlify) y volvé a
        cargar la página.
      </Aviso>
    )
  }

  if (cargando) return <Cargando />

  if (!session) {
    return (
      <Routes>
        <Route path="/primer-uso" element={<PrimerUso />} />
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

  if (perfil.rol === 'entrenador') {
    return (
      <Routes>
        <Route element={<ConPestanas pestanas={PESTANAS_ENTRENADOR} />}>
          <Route path="/alumnos" element={<Alumnos />} />
          <Route path="/planes" element={<Planes />} />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/evolucion" element={<Evolucion />} />
        </Route>
        <Route path="/alumnos/:id" element={<FichaAlumno />} />
        <Route path="*" element={<Navigate to="/alumnos" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<ConPestanas pestanas={PESTANAS_ALUMNO} />}>
        <Route path="/hoy" element={<Hoy />} />
        <Route path="/semana" element={<MiSemana />} />
        <Route path="/progreso" element={<Progreso />} />
      </Route>
      <Route path="*" element={<Navigate to="/hoy" replace />} />
    </Routes>
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
