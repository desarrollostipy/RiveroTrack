// Cobros: comprobantes de transferencia que sube el alumno y exportación a Excel.
import { supabase } from './supabase'
import type { Alumno, Cuota, Pago } from './tipos'

export type Comprobante = {
  id: string
  alumno_id: string
  cuota_ids: string[]
  monto: number
  fecha: string
  referencia: string | null
  archivo: string
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  motivo: string | null
  pago_id: string | null
  revisado_at: string | null
  created_at: string
}

/** Achica una foto a 1600 px como máximo (JPEG): pesa poco y se lee bien. Los PDF pasan tal cual. */
async function prepararArchivo(archivo: File): Promise<{ blob: Blob; extension: string; tipo: string }> {
  if (archivo.type === 'application/pdf') return { blob: archivo, extension: 'pdf', tipo: archivo.type }
  const imagen = await createImageBitmap(archivo)
  const escala = Math.min(1, 1600 / Math.max(imagen.width, imagen.height))
  const c = document.createElement('canvas')
  c.width = Math.round(imagen.width * escala)
  c.height = Math.round(imagen.height * escala)
  c.getContext('2d')!.drawImage(imagen, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob>((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo leer la imagen'))), 'image/jpeg', 0.82))
  return { blob, extension: 'jpg', tipo: 'image/jpeg' }
}

/** Sube el comprobante a la carpeta privada del alumno. Devuelve la ruta guardada. */
export async function subirComprobante(archivo: File) {
  if (!/^image\/|^application\/pdf$/.test(archivo.type)) throw new Error('Subí una foto o un PDF del comprobante.')
  const { data } = await supabase.auth.getUser()
  if (!data.user) throw new Error('Iniciá sesión de nuevo.')
  const { blob, extension, tipo } = await prepararArchivo(archivo)
  if (blob.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB.')
  const ruta = `${data.user.id}/${crypto.randomUUID()}.${extension}`
  const { error } = await supabase.storage.from('comprobantes').upload(ruta, blob, { contentType: tipo, upsert: false })
  if (error) throw new Error('No se pudo subir el comprobante. Probá de nuevo.')
  return ruta
}

/** Link temporal (10 minutos) para ver un comprobante privado. */
export async function verComprobante(ruta: string) {
  const { data } = await supabase.storage.from('comprobantes').createSignedUrl(ruta, 600)
  return data?.signedUrl ?? null
}

/** Excel con alumnos, cuotas, pagos y comprobantes: sirve de respaldo y para la contadora. */
export async function exportarExcel() {
  const [a, c, p, k] = await Promise.all([
    supabase.from('alumnos').select('*').order('nombre'),
    supabase.from('cuotas').select('*').order('periodo', { ascending: false }),
    supabase.from('pagos').select('*').order('fecha', { ascending: false }),
    supabase.from('comprobantes_pago').select('*').order('created_at', { ascending: false }),
  ])
  const alumnos = (a.data ?? []) as Alumno[]
  const nombre = (id: string) => alumnos.find((x) => x.id === id)?.nombre ?? ''
  const fecha = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : null)
  const titulo = (t: string) => ({ value: t, fontWeight: 'bold' as const, backgroundColor: '#DCE6FA' })

  const hojas = [
    {
      sheet: 'Pagos',
      columns: [{ width: 28 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 30 }],
      data: [
        ['Alumno', 'Fecha', 'Monto (Gs.)', 'Medio', 'Referencia'].map(titulo),
        ...((p.data ?? []) as Pago[]).map((x) => [nombre(x.alumno_id), { value: fecha(x.fecha)!, type: Date, format: 'dd/mm/yyyy' }, { value: x.monto, type: Number, format: '#,##0' }, x.medio, x.referencia ?? '']),
      ],
    },
    {
      sheet: 'Cuotas',
      columns: [{ width: 28 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 12 }],
      data: [
        ['Alumno', 'Mes', 'Monto (Gs.)', 'Vence', 'Estado'].map(titulo),
        ...((c.data ?? []) as Cuota[]).map((x) => [
          nombre(x.alumno_id),
          { value: fecha(x.periodo)!, type: Date, format: 'mm/yyyy' },
          { value: x.monto, type: Number, format: '#,##0' },
          { value: fecha(x.vencimiento)!, type: Date, format: 'dd/mm/yyyy' },
          x.estado,
        ]),
      ],
    },
    {
      sheet: 'Alumnos',
      columns: [{ width: 28 }, { width: 12 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 10 }],
      data: [
        ['Nombre', 'CI', 'Teléfono', 'Cuota (Gs.)', 'Vence día', 'Activo'].map(titulo),
        ...alumnos.map((x) => [x.nombre, x.ci ?? '', x.telefono ?? '', { value: x.cuota_mensual, type: Number, format: '#,##0' }, x.dia_vencimiento, x.activo ? 'Sí' : 'No']),
      ],
    },
    {
      sheet: 'Comprobantes',
      columns: [{ width: 28 }, { width: 12 }, { width: 14 }, { width: 12 }, { width: 30 }],
      data: [
        ['Alumno', 'Fecha', 'Monto (Gs.)', 'Estado', 'Referencia / motivo'].map(titulo),
        ...((k.data ?? []) as Comprobante[]).map((x) => [nombre(x.alumno_id), { value: fecha(x.fecha)!, type: Date, format: 'dd/mm/yyyy' }, { value: x.monto, type: Number, format: '#,##0' }, x.estado, x.motivo ?? x.referencia ?? '']),
      ],
    },
  ]
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(hojas, {}).toFile(`rivero-cuentas-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
