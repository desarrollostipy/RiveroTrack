import { useEffect, useState } from 'react'
import { compartirImagen, ESTILOS, FORMATOS, tarjetaSesion, type Dato, type Diseno, type Estilo, type Formato } from '../lib/tarjetas'
import { DIAS, diaSemana } from '../lib/fechas'
import { formatoDuracion, formatoFecha, formatoKm, formatoRitmo } from '../lib/formato'
import type { SesionReg } from '../lib/tipos'
import { kmCorridos } from '../lib/extras'
import { Boton, Hoja, MensajeOk, Pestanas } from './ui'

const SENSACION = ['', '😣 Muy mal', '😕 Mal', '🙂 Normal', '😄 Bien', '🤩 Excelente']

/** Arma la imagen de un entrenamiento registrado. */
export function imagenDeSesion(o: {
  registro: Pick<SesionReg, 'fecha' | 'distancia_km' | 'duracion_seg' | 'ritmo_prom_seg' | 'fc_prom' | 'sensacion' | 'splits'> & { datos_crudos?: { desnivel_m?: number | null } | null; calentamiento_km?: number | null; afloje_km?: number | null }
  tipo: string
  titulo: string
  nombre: string
  planKm?: number | null
  estilo: Diseno
}) {
  const r = o.registro
  const datos: Dato[] = []
  if (r.duracion_seg) datos.push({ etiqueta: 'Tiempo', valor: formatoDuracion(r.duracion_seg) })
  if (r.ritmo_prom_seg) datos.push({ etiqueta: 'Ritmo', valor: `${formatoRitmo(r.ritmo_prom_seg)}/km` })
  if (r.fc_prom) datos.push({ etiqueta: 'Pulso prom.', valor: `${r.fc_prom} ppm` })
  if (r.datos_crudos?.desnivel_m) datos.push({ etiqueta: 'Desnivel', valor: `${r.datos_crudos.desnivel_m} m` })
  if (r.sensacion) datos.push({ etiqueta: 'Sensación', valor: SENSACION[r.sensacion] })
  const total = kmCorridos(r)
  if (r.distancia_km && total > Number(r.distancia_km)) datos.push({ etiqueta: 'Total corrido', valor: `${formatoKm(total)} km` })
  return tarjetaSesion({
    estilo: o.estilo,
    nombre: o.nombre,
    fecha: `${DIAS[diaSemana(r.fecha)]} ${formatoFecha(r.fecha)}`,
    tipo: o.tipo,
    titulo: o.titulo,
    numero: r.distancia_km ? formatoKm(r.distancia_km) : r.duracion_seg ? formatoDuracion(r.duracion_seg) : '✓',
    unidad: r.distancia_km ? 'km' : '',
    datos,
    parciales: (r.splits ?? []).map((s) => s.ritmo_seg),
    plan: o.planKm && r.distancia_km ? { valor: o.planKm, hecho: r.distancia_km, unidad: 'km' } : null,
  })
}

function leer(clave: string) {
  try {
    return localStorage.getItem(clave)
  } catch {
    return null
  }
}
function guardar(clave: string, valor: string) {
  try {
    localStorage.setItem(clave, valor)
  } catch {
    /* sin almacenamiento */
  }
}
function estiloGuardado(): Estilo {
  const e = leer('rivero-estilo-imagen')
  return e === 'blanco' || e === 'transparente' ? e : 'azul'
}
function formatoGuardado(): Formato {
  return leer('rivero-formato-imagen') === 'publicacion' ? 'publicacion' : 'historia'
}

/**
 * Botón "📤 Compartir": arma la imagen (fondo azul, blanco o sin fondo), la muestra
 * y la comparte (WhatsApp, Instagram…) o la descarga si el celular no permite compartir.
 */
export function BotonCompartir({
  generar,
  nombreArchivo,
  texto = '#RiveroTrack 🏃',
  etiqueta = '📤 Compartir',
  variante = 'borde',
  className = '',
}: {
  generar: (diseno: Diseno) => Promise<Blob>
  nombreArchivo: string
  texto?: string
  etiqueta?: string
  variante?: 'borde' | 'primario' | 'texto'
  className?: string
}) {
  const [abierta, setAbierta] = useState(false)
  const [estilo, setEstilo] = useState<Estilo>(estiloGuardado)
  const [formato, setFormato] = useState<Formato>(formatoGuardado)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const [generando, setGenerando] = useState(false)
  const [aviso, setAviso] = useState('')

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url],
  )

  // Se vuelve a dibujar cada vez que se elige otro fondo.
  useEffect(() => {
    if (!abierta) return
    let vigente = true
    setGenerando(true)
    generar({ fondo: estilo, formato })
      .then((b) => {
        if (!vigente) return
        setBlob(b)
        setUrl(URL.createObjectURL(b))
      })
      .finally(() => vigente && setGenerando(false))
    return () => {
      vigente = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierta, estilo, formato])

  function elegir(e: Estilo) {
    setEstilo(e)
    setAviso('')
    guardar('rivero-estilo-imagen', e)
  }

  function elegirFormato(f: Formato) {
    setFormato(f)
    setAviso('')
    guardar('rivero-formato-imagen', f)
  }

  async function compartir() {
    if (!blob) return
    const r = await compartirImagen(blob, nombreArchivo, texto)
    if (r === 'descargada') setAviso('Imagen descargada: la encontrás en tus descargas o en la galería.')
  }

  function cerrar() {
    setAbierta(false)
    setBlob(null)
    setUrl('')
    setAviso('')
  }

  // Para "sin fondo" se muestra sobre cuadritos, como en los editores de fotos.
  const fondoVista =
    estilo === 'transparente' ? { background: 'repeating-conic-gradient(#8a93a6 0% 25%, #b9c0cf 0% 50%) 50% / 24px 24px' } : undefined

  return (
    <>
      <Boton variante={variante} onClick={() => setAbierta(true)} disabled={abierta && generando} className={className}>
        {etiqueta}
      </Boton>
      <Hoja titulo="Compartir" abierta={abierta} onCerrar={cerrar}>
        <Pestanas valor={formato} onChange={elegirFormato} opciones={FORMATOS} />
        <Pestanas valor={estilo} onChange={elegir} opciones={ESTILOS} />
        <div
          className={`relative mx-auto w-full overflow-hidden rounded-2xl shadow-lg ${formato === 'historia' ? 'aspect-[9/16] max-w-[14rem]' : 'aspect-[4/5] max-w-xs'}`}
          style={fondoVista}
        >
          {url && <img src={url} alt="Imagen para compartir" className={`h-full w-full ${generando ? 'opacity-50' : ''}`} />}
          {generando && <p className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-texto-2">Creando imagen…</p>}
        </div>
        {estilo === 'transparente' && (
          <p className="text-center text-xs text-texto-2">Ideal para pegarla encima de una foto en tus historias de Instagram.</p>
        )}
        <Boton onClick={compartir} disabled={!blob || generando}>
          📤 Compartir en WhatsApp, Instagram…
        </Boton>
        <MensajeOk>{aviso}</MensajeOk>
        <p className="text-center text-xs text-texto-2">Usá #RiveroTrack al publicar 💙</p>
      </Hoja>
    </>
  )
}
