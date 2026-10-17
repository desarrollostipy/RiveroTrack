import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { estadoDeuda } from '../../lib/calculos'
import { hoyPY, nombreMes, primerDiaMes, sumarMeses } from '../../lib/fechas'
import { formatoFecha, formatoGs, leerMonto, miles } from '../../lib/formato'
import type { Alumno, Cuota, Pago } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { FormPago } from '../../components/FormPago'
import { Boton, Campo, Cargando, Hoja, Indicador, MensajeError, MensajeOk, Opciones, Vacio } from '../../components/ui'

type Filtro = 'vencidas' | 'pagadas' | 'todos'

export default function Cuentas() {
  const hoy = hoyPY()
  const mes = primerDiaMes(hoy)
  const [alumnos, setAlumnos] = useState<Alumno[] | null>(null)
  const [cuotas, setCuotas] = useState<Cuota[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [filtro, setFiltro] = useState<Filtro>('vencidas')
  const [config, setConfig] = useState(false)
  const [cobrando, setCobrando] = useState<Alumno | null>(null)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const [a, c, p] = await Promise.all([
      supabase.from('alumnos').select('*').order('nombre'),
      supabase.from('cuotas').select('*').or(`estado.eq.pendiente,periodo.eq.${mes}`),
      supabase.from('pagos').select('*').gte('fecha', sumarMeses(mes, -2)).order('fecha', { ascending: false }),
    ])
    setAlumnos((a.data ?? []) as Alumno[])
    setCuotas((c.data ?? []) as Cuota[])
    setPagos((p.data ?? []) as Pago[])
  }, [mes])

  useEffect(() => {
    // Respaldo de pg_cron: genera las cuotas del mes que falten.
    supabase.rpc('generar_cuotas').then(() => cargar())
  }, [cargar])

  if (!alumnos) return <Cargando pantalla />

  const filas = alumnos
    .map((a) => {
      const propias = cuotas.filter((c) => c.alumno_id === a.id)
      const deuda = estadoDeuda(propias, hoy)
      const delMes = propias.find((c) => c.periodo === mes)
      const pagoMes = delMes?.pago_id ? pagos.find((p) => p.id === delMes.pago_id) : null
      const pendientes = propias.filter((c) => c.estado === 'pendiente')
      return { a, deuda, delMes, pagoMes, pendientes }
    })
    .filter((f) => f.a.activo || f.pendientes.length) // inactivos solo si deben

  const vencidas = filas.filter((f) => f.deuda.vencidas.length)
  const conCuotaMes = filas.filter((f) => f.delMes)
  const pagaronMes = conCuotaMes.filter((f) => f.delMes!.estado === 'pagada')
  const cobradoMes = pagos.filter((p) => p.fecha >= mes).reduce((t, p) => t + p.monto, 0)
  const visibles = filtro === 'vencidas' ? vencidas : filtro === 'pagadas' ? pagaronMes : filas

  return (
    <Pantalla
      titulo="Cuentas"
      subtitulo={`${nombreMes(mes)} ${mes.slice(0, 4)}`}
      derecha={
        <Boton variante="borde" onClick={() => setConfig(true)}>
          Configurar cuotas
        </Boton>
      }
    >
      <MensajeOk>{aviso}</MensajeOk>
      <div className="grid grid-cols-2 gap-2">
        <Indicador
          tono="mal"
          valor={formatoGs(vencidas.reduce((t, f) => t + f.deuda.total, 0))}
          texto={`Vencidas · ${vencidas.length} alumno${vencidas.length === 1 ? '' : 's'}`}
        />
        <Indicador tono="ok" valor={formatoGs(cobradoMes)} texto={`Cobrado este mes · ${pagaronMes.length}/${conCuotaMes.length} pagaron`} />
      </div>

      <Opciones
        label="Mostrar"
        valor={filtro}
        onChange={setFiltro}
        opciones={[
          { valor: 'vencidas', texto: `Vencidas (${vencidas.length})` },
          { valor: 'pagadas', texto: `Pagadas (${pagaronMes.length})` },
          { valor: 'todos', texto: `Todos (${filas.length})` },
        ]}
      />

      {visibles.length === 0 && <Vacio>{filtro === 'vencidas' ? 'Nadie tiene cuotas vencidas. 🎉' : 'No hay alumnos en esta lista.'}</Vacio>}

      <ul className="flex flex-col gap-2">
        {visibles.map(({ a, deuda, delMes, pagoMes, pendientes }) => {
          const estado = deuda.vencidas.length
            ? deuda.texto
            : pagoMes
              ? `Pagó ${formatoFecha(pagoMes.fecha)} · ${pagoMes.medio === 'transferencia' ? 'Transferencia' : 'Efectivo'}`
              : delMes?.estado === 'pagada'
                ? 'Pagada'
                : delMes
                  ? `Vence ${formatoFecha(delMes.vencimiento)}`
                  : 'Sin cuota este mes'
          const monto = deuda.vencidas.length ? deuda.total : (delMes?.monto ?? a.cuota_mensual)
          return (
            <li key={a.id} className="rounded-2xl border border-borde bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/alumnos/${a.id}?tab=pagos`} className="min-w-0 hover:underline">
                  <p className="font-semibold">{a.nombre}</p>
                  <p className={`text-sm ${deuda.vencidas.length ? 'text-mal' : pagoMes || delMes?.estado === 'pagada' ? 'text-ok' : 'text-texto-2'}`}>{estado}</p>
                </Link>
                <p className={`shrink-0 font-mono font-semibold ${deuda.vencidas.length ? 'text-mal' : ''}`}>{formatoGs(monto)}</p>
              </div>
              {pendientes.length > 0 && (
                <Boton variante={deuda.vencidas.length ? 'primario' : 'borde'} className="mt-2 w-full" onClick={() => setCobrando(a)}>
                  Registrar pago
                </Boton>
              )}
            </li>
          )
        })}
      </ul>

      <Hoja titulo={cobrando ? `Pago de ${cobrando.nombre}` : ''} abierta={!!cobrando} onCerrar={() => setCobrando(null)}>
        {cobrando && (
          <FormPago
            alumnoId={cobrando.id}
            pendientes={cuotas.filter((c) => c.alumno_id === cobrando.id && c.estado === 'pendiente')}
            montoSugerido={(() => {
              const p = cuotas.filter((c) => c.alumno_id === cobrando.id && c.estado === 'pendiente')
              const v = p.filter((c) => c.vencimiento < hoy)
              return (v.length ? v : p).reduce((t, c) => t + c.monto, 0)
            })()}
            onCancelar={() => setCobrando(null)}
            onListo={() => {
              setAviso(`Pago de ${cobrando.nombre} registrado.`)
              setCobrando(null)
              cargar()
            }}
          />
        )}
      </Hoja>

      <ConfigurarCuotas abierta={config} onCerrar={() => setConfig(false)} onListo={(m) => (setAviso(m), cargar())} />
    </Pantalla>
  )
}

function ConfigurarCuotas({ abierta, onCerrar, onListo }: { abierta: boolean; onCerrar: () => void; onListo: (mensaje: string) => void }) {
  const [monto, setMonto] = useState('')
  const [dia, setDia] = useState('')
  const [aplicar, setAplicar] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierta) return
    supabase
      .from('config_cuotas')
      .select('*')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setMonto(miles(data.monto_default))
          setDia(String(data.dia_vencimiento_default))
        }
      })
  }, [abierta])

  async function guardar() {
    const d = Number(dia)
    if (!Number.isInteger(d) || d < 1 || d > 28) return setError('El día va de 1 a 28.')
    const m = leerMonto(monto)
    const { error } = await supabase
      .from('config_cuotas')
      .update({ monto_default: m, dia_vencimiento_default: d, updated_at: new Date().toISOString() })
      .eq('id', true)
    if (error) return setError(mensajeError(error))
    if (aplicar) {
      const { error } = await supabase.from('alumnos').update({ cuota_mensual: m, dia_vencimiento: d }).eq('activo', true)
      if (error) return setError(mensajeError(error))
    }
    setError('')
    onCerrar()
    onListo(aplicar ? 'Cuota general actualizada y aplicada a los alumnos actuales (desde la próxima cuota).' : 'Cuota general actualizada para alumnos nuevos.')
  }

  return (
    <Hoja titulo="Configurar cuotas" abierta={abierta} onCerrar={onCerrar}>
      <Campo id="cfg-monto" label="Monto general (Gs.)" inputMode="numeric" value={monto} onChange={(e) => setMonto(miles(leerMonto(e.target.value)))} />
      <Campo id="cfg-dia" label="Día de vencimiento general (1 a 28)" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ''))} />
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5" checked={aplicar} onChange={(e) => setAplicar(e.target.checked)} />
        <span>
          Aplicar también a los alumnos actuales
          <span className="block text-sm text-texto-2">Si no lo marcás, se usa solo para alumnos nuevos. Las cuotas ya generadas no cambian.</span>
        </span>
      </label>
      <MensajeError>{error}</MensajeError>
      <Boton onClick={guardar}>Guardar</Boton>
    </Hoja>
  )
}
