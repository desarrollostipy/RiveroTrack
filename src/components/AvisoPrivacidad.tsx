import { Hoja } from './ui'

/** Aviso de privacidad: qué datos se guardan, quién los ve y cómo pedir que se borren. */
export function AvisoPrivacidad({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  return (
    <Hoja titulo="Aviso de privacidad" abierta={abierto} onCerrar={onCerrar}>
      <div className="flex flex-col gap-3 text-sm">
        <p>
          Esta app la usan <b>Rivero Track &amp; Field</b> y sus alumnos para planificar y seguir los entrenamientos.
        </p>
        <div>
          <p className="font-semibold">Qué datos guardamos</p>
          <ul className="ml-4 list-disc">
            <li>Tus datos de contacto: nombre, CI y teléfono.</li>
            <li>Tus entrenamientos: sesiones, ritmos, pulso, peso y competencias.</li>
            <li>Datos de salud que vos cargues: bienestar, molestias, ficha médica y ciclo (este último solo si elegís compartirlo).</li>
            <li>Tus cuotas, pagos y los comprobantes que subas.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Quién los ve</p>
          <ul className="ml-4 list-disc">
            <li>Vos y tu entrenador. Ningún otro alumno ve tus datos.</li>
            <li>En el ranking del mes solo aparecen tu nombre y tus km, y podés elegir no aparecer.</li>
            <li>Las imágenes para redes se publican solo si vos las compartís.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Cómo se protegen</p>
          <p>Se guardan en servidores con acceso restringido por usuario. Nadie más que vos y tu entrenador puede consultarlos.</p>
        </div>
        <div>
          <p className="font-semibold">Tus derechos</p>
          <p>Podés pedirle a tu entrenador ver, corregir o borrar tus datos en cualquier momento.</p>
        </div>
      </div>
    </Hoja>
  )
}
