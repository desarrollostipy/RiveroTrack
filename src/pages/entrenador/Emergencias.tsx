import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { supabase } from '../../lib/supabase'
import type { FichaMedica } from '../../lib/salud'
import { Pantalla } from '../../components/Pantalla'
import { telLink } from '../../components/salud/FichaMedica'
import { Campo, Cargando, Tarjeta, Vacio } from '../../components/ui'

type AlumnoMin = { id: string; nombre: string }

/** Contactos de emergencia y datos médicos de todos, para tener a mano en los entrenamientos. */
export default function Emergencias() {
  const [alumnos, setAlumnos] = useState<AlumnoMin[] | null>(null)
  const [fichas, setFichas] = useState<Record<string, FichaMedica>>({})
  const [buscar, setBuscar] = useState('')

  useEffect(() => {
    Promise.all([supabase.from('alumnos').select('id, nombre').eq('activo', true).order('nombre'), supabase.from('fichas_medicas').select('*')]).then(([a, f]) => {
      setAlumnos((a.data ?? []) as AlumnoMin[])
      setFichas(Object.fromEntries(((f.data ?? []) as FichaMedica[]).map((x) => [x.alumno_id, x])))
    })
  }, [])

  if (!alumnos) return <Cargando pantalla />
  const texto = buscar.trim().toLowerCase()
  const lista = alumnos.filter((a) => !texto || a.nombre.toLowerCase().includes(texto))
  const conContacto = lista.filter((a) => fichas[a.id]?.contacto_telefono)
  const sinContacto = lista.filter((a) => !fichas[a.id]?.contacto_telefono)

  return (
    <Pantalla titulo="🆘 Emergencias" subtitulo="Contactos y datos médicos" volver="/herramientas">
      <Campo id="buscar-emergencia" label="Buscar alumno" type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      {conContacto.length === 0 && <Vacio>Todavía nadie completó su ficha médica.</Vacio>}
      <ul className="flex flex-col gap-2">
        {conContacto.map((a) => {
          const f = fichas[a.id]
          return (
            <li key={a.id}>
              <Tarjeta className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/alumnos/${a.id}?tab=salud`} className="font-semibold">
                    {a.nombre}
                  </Link>
                  <p className="text-sm text-texto-2">
                    {f.contacto_nombre}
                    {f.contacto_relacion ? ` (${f.contacto_relacion})` : ''} · <span className="font-mono">{f.contacto_telefono}</span>
                  </p>
                  <p className="text-sm">
                    {f.grupo_sanguineo && <span className="mr-2 rounded bg-mal/10 px-1.5 font-bold text-mal">🩸 {f.grupo_sanguineo}</span>}
                    {f.alergias && <span className="font-semibold text-mal">Alergias: {f.alergias}</span>}
                  </p>
                  {f.condiciones && <p className="text-sm text-texto-2">⚕️ {f.condiciones}</p>}
                </div>
                <a href={telLink(f.contacto_telefono!)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mal text-xl text-white" aria-label={`Llamar a ${f.contacto_nombre}`}>
                  📞
                </a>
              </Tarjeta>
            </li>
          )
        })}
      </ul>
      {sinContacto.length > 0 && (
        <Tarjeta>
          <p className="mb-1 font-semibold">⚠️ Sin contacto de emergencia ({sinContacto.length})</p>
          <p className="text-sm text-texto-2">{sinContacto.map((a) => a.nombre).join(', ')}</p>
          <p className="mt-2 text-xs text-texto-2">Lo completan desde Mi perfil → Mi salud → Ficha.</p>
        </Tarjeta>
      )}
    </Pantalla>
  )
}
