import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { formatoKm, leerNumero } from '../../lib/formato'
import { estadoCalzado, type Calzado } from '../../lib/salud'
import { Boton, Campo, Hoja, MensajeError, Tarjeta, Titulo, Vacio } from '../ui'

export function useZapatillas(alumnoId: string) {
  const [lista, setLista] = useState<Calzado[] | null>(null)
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('v_calzado_km').select('*').eq('alumno_id', alumnoId).order('created_at')
    setLista(((data ?? []) as Calzado[]).map((c) => ({ ...c, km_total: Number(c.km_total), km_inicial: Number(c.km_inicial) })))
  }, [alumnoId])
  useEffect(() => {
    cargar()
  }, [cargar])
  return { lista, cargar }
}

/** Aviso corto para la pantalla Hoy cuando unas zapatillas en uso llegan al límite. */
export function AvisoZapatillas({ alumnoId }: { alumnoId: string }) {
  const { lista } = useZapatillas(alumnoId)
  const gastada = lista?.find((c) => !c.retirada && estadoCalzado(c).aviso)
  if (!gastada) return null
  const cambiar = estadoCalzado(gastada).aviso === 'cambiar'
  return (
    <Link to="/zapatillas" className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${cambiar ? 'bg-mal/10 text-mal' : 'bg-parcial/20 text-tinta'}`}>
      <span className="text-2xl" aria-hidden="true">
        👟
      </span>
      <span className="text-sm">
        <b>{gastada.nombre}</b>: {formatoKm(gastada.km_total)} km. {cambiar ? 'Ya conviene cambiarlas.' : 'Se acercan al límite.'}
      </span>
    </Link>
  )
}

function BarraKm({ c }: { c: Calzado }) {
  const { pct, aviso } = estadoCalzado(c)
  const color = aviso === 'cambiar' ? 'bg-mal' : aviso === 'pronto' ? 'bg-parcial' : 'bg-ok'
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-borde" role="progressbar" aria-valuenow={Math.round(pct * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
    </div>
  )
}

/** Mis zapatillas: km de cada par, cuál uso por defecto y cuándo conviene cambiarlas. */
export function Zapatillas({ alumnoId, editable = true }: { alumnoId: string; editable?: boolean }) {
  const { lista, cargar } = useZapatillas(alumnoId)
  const [abierta, setAbierta] = useState(false)
  const [editar, setEditar] = useState<Calzado | null>(null)
  const [nombre, setNombre] = useState('')
  const [kmIni, setKmIni] = useState('')
  const [limite, setLimite] = useState('700')
  const [error, setError] = useState('')

  function abrir(c: Calzado | null) {
    setEditar(c)
    setNombre(c?.nombre ?? '')
    setKmIni(c ? String(c.km_inicial) : '')
    setLimite(String(c?.limite_km ?? 700))
    setError('')
    setAbierta(true)
  }

  async function guardar() {
    const ini = kmIni.trim() ? leerNumero(kmIni) : 0
    const lim = leerNumero(limite)
    if (!nombre.trim()) return setError('Poné un nombre, por ejemplo "Pegasus 40".')
    if (ini === null || ini < 0) return setError('Los km iniciales tienen que ser un número.')
    if (!lim || lim < 100 || lim > 2000) return setError('El límite va entre 100 y 2000 km.')
    const datos = { nombre: nombre.trim(), km_inicial: ini, limite_km: Math.round(lim) }
    const primera = !lista?.some((c) => !c.retirada)
    const { error } = editar
      ? await supabase.from('calzado').update(datos).eq('id', editar.id)
      : await supabase.from('calzado').insert({ ...datos, alumno_id: alumnoId, principal: primera })
    if (error) return setError(mensajeError(error))
    setAbierta(false)
    cargar()
  }

  async function principal(c: Calzado) {
    await supabase.from('calzado').update({ principal: false }).eq('alumno_id', alumnoId)
    await supabase.from('calzado').update({ principal: true }).eq('id', c.id)
    cargar()
  }

  async function retirar(c: Calzado) {
    await supabase.from('calzado').update({ retirada: !c.retirada, principal: false }).eq('id', c.id)
    cargar()
  }

  if (!lista) return null
  const enUso = lista.filter((c) => !c.retirada)
  const retiradas = lista.filter((c) => c.retirada)

  return (
    <Tarjeta>
      <Titulo accion={editable ? <Boton variante="texto" onClick={() => abrir(null)}>+ Agregar</Boton> : undefined}>👟 Zapatillas</Titulo>
      {enUso.length === 0 ? (
        <Vacio>{editable ? 'Agregá tus zapatillas para llevar la cuenta de los km.' : 'Sin zapatillas cargadas.'}</Vacio>
      ) : (
        <ul className="flex flex-col gap-2">
          {enUso.map((c) => {
            const { aviso } = estadoCalzado(c)
            return (
              <li key={c.id} className={`rounded-2xl border-2 p-3 ${c.principal ? 'border-azul' : 'border-borde'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {c.nombre} {c.principal && <span className="ml-1 rounded-full bg-azul px-2 py-0.5 text-xs text-white">Principal</span>}
                    </p>
                    <p className="text-sm text-texto-2">
                      <b className="font-mono text-tinta">{formatoKm(c.km_total)}</b> de {c.limite_km} km
                      {aviso === 'cambiar' ? ' · ⚠️ conviene cambiarlas' : aviso === 'pronto' ? ' · se acercan al límite' : ''}
                    </p>
                  </div>
                  {editable && (
                    <Boton variante="texto" onClick={() => abrir(c)}>
                      Editar
                    </Boton>
                  )}
                </div>
                <BarraKm c={c} />
                {editable && (
                  <div className="mt-2 flex gap-3 text-sm font-semibold">
                    {!c.principal && (
                      <button type="button" className="text-azul" onClick={() => principal(c)}>
                        Usar por defecto
                      </button>
                    )}
                    <button type="button" className="text-texto-2" onClick={() => retirar(c)}>
                      Retirar
                    </button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {retiradas.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-semibold text-azul">Retiradas ({retiradas.length})</summary>
          <ul className="mt-2 flex flex-col gap-1 text-texto-2">
            {retiradas.map((c) => (
              <li key={c.id} className="flex justify-between">
                <span>
                  {c.nombre} · {formatoKm(c.km_total)} km
                </span>
                {editable && (
                  <button type="button" className="font-semibold text-azul" onClick={() => retirar(c)}>
                    Volver a usar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
      {editable && <p className="mt-3 text-xs text-texto-2">Al registrar una sesión elegís con qué zapatillas corriste y los km se suman solos.</p>}

      <Hoja titulo={editar ? 'Editar zapatillas' : 'Nuevas zapatillas'} abierta={abierta} onCerrar={() => setAbierta(false)}>
        <Campo id="z-nombre" label="Nombre" placeholder="Ej.: Pegasus 40 azules" value={nombre} maxLength={60} onChange={(e) => setNombre(e.target.value)} />
        <Campo id="z-ini" label="Km que ya tenían (opcional)" inputMode="decimal" value={kmIni} onChange={(e) => setKmIni(e.target.value)} />
        <Campo id="z-lim" label="Cambiarlas a los (km)" inputMode="numeric" ayuda="Lo habitual es entre 600 y 800 km." value={limite} onChange={(e) => setLimite(e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar}>Guardar</Boton>
      </Hoja>
    </Tarjeta>
  )
}
