// Firma discreta de quien desarrolló la app.
// Para cambiar el nombre, alcanza con modificar DESARROLLO.
export const DESARROLLO = 'TiPy Labs'

export function Firma({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-[0.7rem] tracking-wide text-texto-2/70 ${className}`}>
      Desarrollado por <span className="font-semibold">{DESARROLLO}</span>
    </p>
  )
}
