import { Pantalla } from '../../components/Pantalla'
import { Ranking } from '../../components/comunidad/Ranking'

export default function RankingEntrenador() {
  return (
    <Pantalla titulo="🏅 Ranking del mes" subtitulo="Los ocultos se ven en gris (solo vos los ves)" volver="/herramientas">
      <Ranking modo="entrenador" />
    </Pantalla>
  )
}
