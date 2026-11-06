import { Suspense, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Cargando } from './ui'

export type Pestana = { a: string; texto: string; icono: ReactNode; aviso?: number }

// Pantallas de inicio de cada rol, con el menú flotante abajo.
// `central`: botón destacado en el medio del menú (el "+ Cargar" del alumno).
export function ConPestanas({ pestanas, central }: { pestanas: Pestana[]; central?: ReactNode }) {
  const mitad = Math.ceil(pestanas.length / 2)
  const item = (p: Pestana) => (
    <li key={p.a} className="flex-1">
      <NavLink
        to={p.a}
        className={({ isActive }) =>
          `group flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-semibold ${
            isActive ? 'text-tinta' : 'text-texto-2 hover:text-tinta'
          }`
        }
      >
        {({ isActive }) => (
          <>
            <span
              className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300 ${
                isActive ? 'boton-accion scale-105' : ''
              }`}
            >
              {p.icono}
              {p.aviso ? (
                <span className="absolute -right-1 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-mal px-1 text-[0.65rem] font-bold text-white ring-2 ring-superficie">
                  {p.aviso > 9 ? '9+' : p.aviso}
                </span>
              ) : null}
            </span>
            {p.texto}
            {p.aviso ? <span className="sr-only"> ({p.aviso} sin leer)</span> : null}
          </>
        )}
      </NavLink>
    </li>
  )
  return (
    <div className="min-h-dvh pb-[calc(6.5rem+env(safe-area-inset-bottom))]">
      {/* Al cambiar de pestaña, el menú queda fijo mientras carga. */}
      <Suspense fallback={<Cargando />}>
        <Outlet />
      </Suspense>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <ul className="mx-auto flex max-w-xl items-center rounded-[1.75rem] border border-borde bg-superficie/85 px-1.5 py-1 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)] backdrop-blur-xl">
          {pestanas.slice(0, central ? mitad : pestanas.length).map(item)}
          {central && <li className="flex shrink-0 justify-center px-0.5">{central}</li>}
          {central && pestanas.slice(mitad).map(item)}
        </ul>
      </nav>
    </div>
  )
}
