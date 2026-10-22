import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { hoyPY, nombreMes, primerDiaMes, sumarMeses } from '../../lib/fechas'
import { formatoGs, miles } from '../../lib/formato'
import { exportarExcel } from '../../lib/cobros'
import { linkWhatsApp, textoRecordatorioCuota } from '../../lib/whatsapp'
import type { Alumno, Cuota, Pago } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { RevisarComprobantes } from '../../components/Comprobantes'
import { Boton, Cargando, Indicador, MensajeError, SelectorPeriodo, Tarjeta, Titulo, Vacio } from '../../components/ui'

/** Finanzas: cobrado, pendiente y vencido del mes, ingresos de 12 meses, deudores y Excel. */
export default function Finanzas() {
  const hoy = hoyPY()
  const [mes, setMes] = useState(primerDiaMes(hoy))
  const [datos, setDatos] = useState<{ alumnos: Alumno[]; cuotas: Cuota[]; pagos: Pago[] } | null>(null)
  const [exportando, setExportando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    const desde = sumarMeses(primerDiaMes(hoy), -11)
    const [a, c, p] = await Promise.all([
      supabase.from('alumnos').select('*').order('nombre'),
      supabase.from('cuotas').select('*').or(`estado.eq.pendiente,periodo.gte.${desde}`),
      supabase.from('pagos').select('*').gte('fecha', desde),
    ])
    setDatos({ alumnos: (a.data ?? []) as Alumno[], cuotas: (c.data ?? []) as Cuota[], pagos: (p.data ?? []) as Pago[] })
  }, [hoy])

  useEffect(() => {
    cargar()
  }, [cargar])

  async function excel() {
    setExportando(true)
    setError('')
    try {
      await exportarExcel()
    } catch {
      setError('No se pudo armar el Excel. Probá de nuevo.')
    } finally {
      setExportando(false)
    }
  }

  if (!datos) return <Cargando pantalla />
  const hasta = sumarMeses(mes, 1)
  const pagosMes = datos.pagos.filter((p) => p.fecha >= mes && p.fecha < hasta)
  const cobrado = pagosMes.reduce((t, p) => t + p.monto, 0)
  const transferencia = pagosMes.filter((p) => p.medio === 'transferencia').reduce((t, p) => t + p.monto, 0)
  const cuotasMes = datos.cuotas.filter((c) => c.periodo === mes)
  const pendienteMes = cuotasMes.filter((c) => c.estado === 'pendiente').reduce((t, c) => t + c.monto, 0)
  const vencidas = datos.cuotas.filter((c) => c.estado === 'pendiente' && c.vencimiento < hoy)
  const totalVencido = vencidas.reduce((t, c) => t + c.monto, 0)

  const meses = Array.from({ length: 12 }, (_, i) => sumarMeses(primerDiaMes(hoy), i - 11))
  const porMes = meses.map((m) => {
    const ps = datos.pagos.filter((p) => p.fecha >= m && p.fecha < sumarMeses(m, 1))
    return { m, transf: ps.filter((p) => p.medio === 'transferencia').reduce((t, p) => t + p.monto, 0), efectivo: ps.filter((p) => p.medio === 'efectivo').reduce((t, p) => t + p.monto, 0) }
  })
  const max = Math.max(1, ...porMes.map((x) => x.transf + x.efectivo))

  const deudores = datos.alumnos
    .map((a) => ({ a, cuotas: vencidas.filter((c) => c.alumno_id === a.id) }))
    .filter((d) => d.cuotas.length)
    .sort((x, y) => y.cuotas.reduce((t, c) => t + c.monto, 0) - x.cuotas.reduce((t, c) => t + c.monto, 0))

  return (
    <Pantalla titulo="📊 Finanzas" volver="/cuentas">
      <RevisarComprobantes onCambio={cargar} />

      <SelectorPeriodo
        texto={`${nombreMes(mes)} ${mes.slice(0, 4)}`}
        detalle={mes === primerDiaMes(hoy) ? 'Mes actual' : null}
        onAnterior={() => mes > meses[0] && setMes(sumarMeses(mes, -1))}
        onSiguiente={() => mes < primerDiaMes(hoy) && setMes(sumarMeses(mes, 1))}
      />
      <div className="grid grid-cols-2 gap-2">
        <Indicador tono="ok" valor={formatoGs(cobrado)} texto={`Cobrado · ${pagosMes.length} pago${pagosMes.length === 1 ? '' : 's'}`} />
        <Indicador valor={formatoGs(pendienteMes)} texto={`Pendiente del mes · ${cuotasMes.filter((c) => c.estado === 'pendiente').length} cuotas`} />
        <Indicador tono="mal" valor={formatoGs(totalVencido)} texto={`Vencido total · ${deudores.length} alumno${deudores.length === 1 ? '' : 's'}`} />
        <Indicador tono="azul" valor={cobrado ? `${Math.round((100 * transferencia) / cobrado)}%` : '—'} texto="por transferencia" />
      </div>

      <Tarjeta>
        <Titulo>Ingresos de los últimos 12 meses</Titulo>
        <div className="flex h-40 gap-1" role="img" aria-label="Ingresos por mes">
          {porMes.map((x) => {
            const total = x.transf + x.efectivo
            return (
              <button key={x.m} type="button" onClick={() => setMes(x.m)} className="flex flex-1 flex-col items-center gap-1" title={`${nombreMes(x.m)}: ${formatoGs(total)}`}>
                <div className="flex w-full flex-1 flex-col justify-end">
                  <div className="w-full rounded-t-md bg-azul" style={{ height: `${(100 * x.transf) / max}%` }} />
                  <div className="w-full bg-[#7EA6FF]" style={{ height: `${(100 * x.efectivo) / max}%` }} />
                </div>
                <span className={`text-[0.6rem] ${x.m === mes ? 'font-bold text-azul' : 'text-texto-2'}`}>{nombreMes(x.m).slice(0, 3)}</span>
              </button>
            )
          })}
        </div>
        <p className="mt-2 flex gap-4 text-xs text-texto-2">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-azul" /> Transferencia
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#7EA6FF]" /> Efectivo
          </span>
          <span className="ml-auto">Total 12 meses: {miles(porMes.reduce((t, x) => t + x.transf + x.efectivo, 0))}</span>
        </p>
      </Tarjeta>

      <Tarjeta>
        <Titulo>Deudores</Titulo>
        {deudores.length === 0 ? (
          <Vacio>Nadie tiene cuotas vencidas 🎉</Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {deudores.map(({ a, cuotas }) => (
              <li key={a.id} className="flex items-center gap-2 py-2">
                <Link to={`/alumnos/${a.id}?tab=pagos`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{a.nombre}</span>
                  <span className="block text-sm text-texto-2">{cuotas.map((c) => nombreMes(c.periodo)).join(', ')}</span>
                </Link>
                <span className="shrink-0 font-mono text-sm font-bold text-mal">{formatoGs(cuotas.reduce((t, c) => t + c.monto, 0))}</span>
                {a.telefono && (
                  <a
                    href={linkWhatsApp(a.telefono!, textoRecordatorioCuota(a.nombre, cuotas))}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-xl bg-[#25D366] px-2 py-1.5 text-sm font-semibold text-white"
                    aria-label={`Recordar por WhatsApp a ${a.nombre}`}
                  >
                    📲
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      <MensajeError>{error}</MensajeError>
      <Boton variante="oscuro" onClick={excel} disabled={exportando}>
        {exportando ? 'Armando el Excel…' : '⬇️ Exportar todo a Excel'}
      </Boton>
      <p className="text-center text-xs text-texto-2">Alumnos, cuotas, pagos y comprobantes. Sirve también como copia de seguridad.</p>
    </Pantalla>
  )
}
