import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { mensajeError } from '../../lib/consultas'
import { useGrupos } from '../../lib/grupos'
import { notificar } from '../../lib/push'
import { formatoFecha } from '../../lib/formato'
import type { Anuncio } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { AreaTexto, Boton, MensajeError, MensajeOk, Selector, Tarjeta, Titulo, Vacio } from '../../components/ui'
import { EtiquetaGrupo } from './Grupos'

// Anuncios para todos los alumnos o para un grupo. Les llega también como notificación.
export default function Anuncios() {
  const { grupos, grupo } = useGrupos()
  const [lista, setLista] = useState<Anuncio[]>([])
  const [texto, setTexto] = useState('')
  const [grupoId, setGrupoId] = useState('')
  const [fijar, setFijar] = useState(false)
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    const { data } = await supabase.from('anuncios').select('*').order('created_at', { ascending: false }).limit(50)
    setLista((data ?? []) as Anuncio[])
  }, [])
  useEffect(() => {
    cargar()
  }, [cargar])

  async function publicar() {
    setError('')
    if (!texto.trim()) return setError('Escribí el anuncio.')
    const { data, error } = await supabase
      .from('anuncios')
      .insert({ texto: texto.trim(), grupo_id: grupoId || null, fijado: fijar })
      .select('id')
      .single()
    if (error) return setError(mensajeError(error))
    notificar({ tipo: 'anuncio', anuncio_id: (data as { id: string }).id })
    setTexto('')
    setFijar(false)
    setAviso('Anuncio publicado. Les llega a tus alumnos.')
    cargar()
  }

  async function alternarFijado(a: Anuncio) {
    await supabase.from('anuncios').update({ fijado: !a.fijado }).eq('id', a.id)
    cargar()
  }

  async function borrar(a: Anuncio) {
    if (!confirm('¿Borrar este anuncio?')) return
    await supabase.from('anuncios').delete().eq('id', a.id)
    cargar()
  }

  return (
    <Pantalla titulo="Anuncios" subtitulo="Aparecen en la pantalla Hoy de tus alumnos" volver="/herramientas">
      <Tarjeta className="flex flex-col gap-3">
        <Titulo>Nuevo anuncio</Titulo>
        <AreaTexto
          id="anuncio-texto"
          label="Mensaje"
          rows={3}
          maxLength={1000}
          placeholder="Ej: Mañana entrenamos en la Costanera a las 6:00. ¡No falten! 🏃"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <Selector id="anuncio-grupo" label="Para" value={grupoId} onChange={(e) => setGrupoId(e.target.value)}>
          <option value="">Todos los alumnos</option>
          {grupos.map((g) => (
            <option key={g.id} value={g.id}>
              Grupo: {g.nombre}
            </option>
          ))}
        </Selector>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={fijar} onChange={(e) => setFijar(e.target.checked)} />
          <span>📌 Fijar arriba (queda visible hasta que lo saques)</span>
        </label>
        <MensajeError>{error}</MensajeError>
        <MensajeOk>{aviso}</MensajeOk>
        <Boton onClick={publicar}>Publicar anuncio</Boton>
      </Tarjeta>

      <Titulo>Publicados</Titulo>
      {lista.length === 0 && <Vacio>Todavía no publicaste anuncios.</Vacio>}
      <ul className="flex flex-col gap-2">
        {lista.map((a) => (
          <li key={a.id} className="rounded-2xl border border-borde bg-superficie p-3">
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-texto-2">
              <span>{formatoFecha(a.created_at)}</span>
              {a.grupo_id ? <EtiquetaGrupo grupo={grupo(a.grupo_id)} /> : <span>Para todos</span>}
              {a.fijado && <span className="font-semibold text-azul">📌 Fijado</span>}
            </div>
            <p className="whitespace-pre-wrap">{a.texto}</p>
            <div className="mt-1 flex gap-1">
              <Boton variante="texto" onClick={() => alternarFijado(a)}>
                {a.fijado ? 'Desfijar' : 'Fijar'}
              </Boton>
              <Boton variante="texto" onClick={() => borrar(a)}>
                Borrar
              </Boton>
            </div>
          </li>
        ))}
      </ul>
    </Pantalla>
  )
}
