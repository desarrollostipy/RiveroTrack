import type { ReactNode } from 'react'

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const IconoAlumnos = () => (
  <Icono>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.8 3.5 5.7" />
  </Icono>
)

export const IconoPlanes = () => (
  <Icono>
    <rect x="3" y="4.5" width="18" height="16" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4M7.5 14h3M13.5 14h3M7.5 17h3" />
  </Icono>
)

export const IconoCuentas = () => (
  <Icono>
    <rect x="2.5" y="6" width="19" height="13" rx="2" />
    <path d="M2.5 10h19M6.5 15h4" />
  </Icono>
)

export const IconoEvolucion = () => (
  <Icono>
    <path d="M3 20h18" />
    <path d="M4 16l5-5 4 3 7-7" />
    <path d="M15 7h5v5" />
  </Icono>
)

export const IconoHoy = () => (
  <Icono>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Icono>
)

export const IconoCarreras = () => (
  <Icono>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </Icono>
)

export const IconoSemana = () => (
  <Icono>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" strokeWidth="3" />
  </Icono>
)
