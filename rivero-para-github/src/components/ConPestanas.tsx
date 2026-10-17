import type { ReactNode } from 'react'
import { NavLink, Outlet } from 'react-router'

export type Pestana = { a: string; texto: string; icono: ReactNode }

// Pantallas de inicio de cada rol, con la barra de navegación inferior.
export function ConPestanas({ pestanas }: { pestanas: Pestana[] }) {
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <Outlet />
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-borde bg-white pb-[env(safe-area-inset-bottom)]"
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
                {p.icono}
                {p.texto}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
