import { Suspense, type ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'
import { Cargando } from './ui'

export type Pestana = { a: string; texto: string; icono: ReactNode; aviso?: number }

// Pantallas de inicio de cada rol, con la barra de navegación inferior.
export function ConPestanas({ pestanas }: { pestanas: Pestana[] }) {
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      {/* Al cambiar de pestaña, la barra de abajo queda fija mientras carga. */}
      <Suspense fallback={<Cargando />}>
        <Outlet />
      </Suspense>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-superficie pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-xl">
          {pestanas.map((p) => (
            <li key={p.a} className="flex-1">
              <NavLink
                to={p.a}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                    isActive ? 'text-azul' : 'text-texto-2'
                  }`
                }
              >
                <span className="relative">
                  {p.icono}
                  {p.aviso ? (
                    <span className="absolute -right-2.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-mal px-1 text-[0.65rem] font-bold text-white">
                      {p.aviso > 9 ? '9+' : p.aviso}
                    </span>
                  ) : null}
                </span>
                {p.texto}
                {p.aviso ? <span className="sr-only"> ({p.aviso} sin leer)</span> : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
