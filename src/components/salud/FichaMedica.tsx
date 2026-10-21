import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import type { FichaMedica as Ficha } from '../../lib/salud'
import { AreaTexto, Boton, Campo, MensajeError, MensajeOk, Opciones, Tarjeta, Titulo } from '../ui'

const GRUPOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const
const VACIA = (alumnoId: string): Ficha => ({
  alumno_id: alumnoId, grupo_sanguineo: null, alergias: null, condiciones: null, medicacion: null,
  seguro_medico: null, contacto_nombre: null, contacto_relacion: null, contacto_telefono: null,
})

/** Para llamar desde el celular: solo números y el + inicial. */
export const telLink = (t: string) => `tel:${t.replace(/[^\d+]/g, '')}`

/** Ficha médica y contacto de emergencia. La completa el alumno; el entrenador la ve y también puede editarla. */
export function FichaMedica({ alumnoId }: { alumnoId: string }) {
  const [ficha, setFicha] = useState<Ficha | null>(null)
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  useEffect(() => {
    supabase
      .from('fichas_medicas')
      .select('*')
      .eq('alumno_id', alumnoId)
      .maybeSingle()
      .then(({ data }) => {
        setFicha((data as Ficha | null) ?? VACIA(alumnoId))
        if (!data) setEditando(true)
      })
  }, [alumnoId])

  if (!ficha) return null
  const cambiar = (campo: keyof Ficha, valor: string | null) => setFicha({ ...ficha, [campo]: valor || null })
  const vacia = !ficha.contacto_telefono && !ficha.grupo_sanguineo && !ficha.alergias

  async function guardar() {
    if (!ficha) return
    if (ficha.contacto_telefono && !ficha.contacto_nombre) return setError('Poné el nombre del contacto de emergencia.')
    const { error } = await supabase.from('fichas_medicas').upsert({ ...ficha, updated_at: new Date().toISOString() }, { onConflict: 'alumno_id' })
    if (error) return setError(mensajeError(error))
    setError('')
    setOk('Ficha guardada.')
    setEditando(false)
  }

  if (!editando)
    return (
      <Tarjeta>
        <Titulo
          accion={
            <Boton variante="texto" onClick={() => (setEditando(true), setOk(''))}>
              Editar
            </Boton>
          }
        >
          🆘 Ficha médica
        </Titulo>
        <MensajeOk>{ok}</MensajeOk>
        {ficha.contacto_telefono ? (
          <a href={telLink(ficha.contacto_telefono)} className="mb-3 flex items-center gap-3 rounded-2xl bg-mal/10 p-3 text-mal">
            <span className="text-2xl" aria-hidden="true">
              📞
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase">Contacto de emergencia</span>
              <span className="block font-semibold text-tinta">
                {ficha.contacto_nombre}
                {ficha.contacto_relacion ? ` (${ficha.contacto_relacion})` : ''}
              </span>
              <span className="block font-mono">{ficha.contacto_telefono}</span>
            </span>
            <span className="rounded-xl bg-mal px-3 py-2 text-sm font-semibold text-white">Llamar</span>
          </a>
        ) : (
          <p className="mb-3 rounded-xl bg-parcial/20 p-3 text-sm">⚠️ Falta el contacto de emergencia.</p>
        )}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <div>
            <dt className="text-texto-2">Grupo sanguíneo</dt>
            <dd className="font-semibold">{ficha.grupo_sanguineo ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-texto-2">Seguro / prepaga</dt>
            <dd className="font-semibold">{ficha.seguro_medico ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-texto-2">Alergias</dt>
            <dd className={ficha.alergias ? 'font-semibold text-mal' : 'font-semibold'}>{ficha.alergias ?? 'Ninguna indicada'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-texto-2">Condiciones o lesiones</dt>
            <dd className="font-semibold">{ficha.condiciones ?? '—'}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-texto-2">Medicación</dt>
            <dd className="font-semibold">{ficha.medicacion ?? '—'}</dd>
          </div>
        </dl>
      </Tarjeta>
    )

  return (
    <Tarjeta>
      <Titulo>🆘 Ficha médica</Titulo>
      {vacia && <p className="-mt-1 mb-3 text-sm text-texto-2">Solo la ve tu entrenador. Sirve si pasa algo durante un entrenamiento.</p>}
      <div className="flex flex-col gap-3">
        <p className="font-semibold">Contacto de emergencia</p>
        <div className="grid grid-cols-2 gap-2">
          <Campo id="fm-cn" label="Nombre" value={ficha.contacto_nombre ?? ''} maxLength={80} onChange={(e) => cambiar('contacto_nombre', e.target.value)} />
          <Campo id="fm-cr" label="Relación" placeholder="Mamá, pareja…" value={ficha.contacto_relacion ?? ''} maxLength={40} onChange={(e) => cambiar('contacto_relacion', e.target.value)} />
        </div>
        <Campo id="fm-ct" label="Teléfono" inputMode="tel" placeholder="0981 123 456" value={ficha.contacto_telefono ?? ''} maxLength={30} onChange={(e) => cambiar('contacto_telefono', e.target.value)} />
        <p className="mt-1 font-semibold">Datos médicos</p>
        <Opciones label="Grupo sanguíneo" valor={ficha.grupo_sanguineo} onChange={(v) => cambiar('grupo_sanguineo', v)} opciones={GRUPOS.map((g) => ({ valor: g, texto: g }))} />
        <Campo id="fm-seg" label="Seguro médico o prepaga" value={ficha.seguro_medico ?? ''} maxLength={100} onChange={(e) => cambiar('seguro_medico', e.target.value)} />
        <AreaTexto id="fm-al" label="Alergias" placeholder="Medicamentos, alimentos, picaduras…" rows={2} value={ficha.alergias ?? ''} maxLength={300} onChange={(e) => cambiar('alergias', e.target.value)} />
        <AreaTexto id="fm-co" label="Condiciones o lesiones" placeholder="Asma, hipertensión, cirugías…" rows={2} value={ficha.condiciones ?? ''} maxLength={300} onChange={(e) => cambiar('condiciones', e.target.value)} />
        <AreaTexto id="fm-me" label="Medicación habitual" rows={2} value={ficha.medicacion ?? ''} maxLength={300} onChange={(e) => cambiar('medicacion', e.target.value)} />
        <MensajeError>{error}</MensajeError>
        <Boton onClick={guardar}>Guardar ficha</Boton>
      </div>
    </Tarjeta>
  )
}
