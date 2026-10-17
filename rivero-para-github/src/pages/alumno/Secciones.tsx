import { useSesion } from '../../lib/sesion'
import { fechaLarga, hoyPY } from '../../lib/fechas'
import { Pantalla } from '../../components/Pantalla'
import { Boton, EnConstruccion, Logo } from '../../components/ui'

// Pantallas vacías de la Etapa 0. Cada una pasa a su propio archivo
// cuando se construye.

export function Hoy() {
  const { perfil, salir } = useSesion()
  const fecha = fechaLarga(hoyPY())
  return (
    <Pantalla
      titulo={`Hola, ${perfil?.nombre.split(' ')[0] ?? ''}`}
      subtitulo={fecha.charAt(0).toUpperCase() + fecha.slice(1)}
      derecha={<Logo className="h-11 w-11 text-[0.6rem]" />}
    >
      <EnConstruccion etapa={2}>
        Tu sesión de hoy, la semana día por día, el último feedback de tu entrenador y tu próxima competencia.
      </EnConstruccion>
      <Boton variante="borde" onClick={salir} className="self-start">
        Salir
      </Boton>
    </Pantalla>
  )
}

export function MiSemana() {
  return (
    <Pantalla titulo="Mi semana">
      <EnConstruccion etapa={2}>Lo planificado, lo que hiciste y el comentario de tu entrenador.</EnConstruccion>
    </Pantalla>
  )
}

export function Progreso() {
  return (
    <Pantalla titulo="Progreso">
      <EnConstruccion etapa={4}>Peso y altura, km por semana, cumplimiento y marcas personales.</EnConstruccion>
    </Pantalla>
  )
}
