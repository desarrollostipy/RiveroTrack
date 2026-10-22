import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMiAlumno } from '../../lib/alumno'
import { cargarSemanas, semanasEnMemoria } from '../../lib/consultas'
import { resumenSemana } from '../../lib/calculos'
import { DIAS, diaSemana, hoyPY, lunesDe, rangoSemana, sumarDias } from '../../lib/fechas'
import { formatoKm } from '../../lib/formato'
import type { SemanaCompleta } from '../../lib/tipos'
import { Pantalla } from '../../components/Pantalla'
import { AgregarCalendario } from '../../components/AgregarCalendario'
import { BotonCompartir, imagenDeSesion } from '../../components/Compartir'
import { tarjetaLista } from '../../lib/tarjetas'
import { kmCorridos, useExtras, type ActividadExtra } from '../../lib/extras'
import { ChipExtra, FormExtra } from '../../components/ActividadesExtra'
import { supabase } from '../../lib/supabase'
import { ListaDias, useTipos } from '../../components/Semana'
import { Boton, Cargando, Indicador, SelectorPeriodo, Tarjeta, Vacio } from '../../components/ui'

export default function MiSemana() {
  const { alumno } = useMiAlumno()
  const { tipo } = useTipos()
  const hoy = hoyPY()
  const [lunes, setLunes] = useState(lunesDe(hoy))
  const [semana, setSemana] = useState<SemanaCompleta | null | undefined>(undefined)
  const { extras, recargarExtras } = useExtras(alumno.id, lunes, sumarDias(lunes, 6))
  const [extraEn, setExtraEn] = useState<string | null>(null)

  async function borrarExtra(a: ActividadExtra) {
    if (!confirm('¿Borrar esta actividad?')) return
    await supabase.from('actividades_extra').delete().eq('id', a.id)
    recargarExtras()
  }

  useEffect(() => {
    const consulta = { alumnoId: alumno.id, desde: lunes, hasta: lunes }
    // Si ya se vio esta semana, se muestra al instante y se actualiza de fondo.
    const guardada = semanasEnMemoria(consulta)
    setSemana(guardada ? (guardada[0] ?? null) : undefined)
    cargarSemanas(consulta).then(([s]) => setSemana(s ?? null))
    // Precargar las semanas vecinas para que las flechas respondan al instante.
    for (const d of [-7, 7]) {
      const vecina = { alumnoId: alumno.id, desde: sumarDias(lunes, d), hasta: sumarDias(lunes, d) }
      if (!semanasEnMemoria(vecina)) cargarSemanas(vecina).catch(() => {})
    }
  }, [alumno.id, lunes])

  const r = semana ? resumenSemana(semana.sesiones) : null
  const semanaActual = lunesDe(hoy)

  return (
    <Pantalla titulo="Mi semana">
      <SelectorPeriodo
        texto={rangoSemana(lunes)}
        detalle={lunes === semanaActual ? 'Semana actual' : lunes < semanaActual ? 'Semana anterior' : 'Próxima semana'}
        onAnterior={() => setLunes(sumarDias(lunes, -7))}
        onSiguiente={() => setLunes(sumarDias(lunes, 7))}
      />
      {semana === undefined && <Cargando />}
      {semana === null && <Vacio>{lunes > semanaActual ? 'Tu entrenador todavía no publicó este plan.' : 'No hay plan publicado para esta semana.'}</Vacio>}
      {semana === null && lunes <= semanaActual && (
        <>
          {extras.map((x) => (
            <ChipExtra key={x.id} a={x} onBorrar={() => borrarExtra(x)} />
          ))}
          <Boton variante="borde" onClick={() => setExtraEn(lunes === semanaActual ? hoy : sumarDias(lunes, 6))}>
            + Actividad extra
          </Boton>
        </>
      )}
      {semana && r && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Indicador valor={`${formatoKm(r.kmReal)} / ${r.estimado ? '≈' : ''}${formatoKm(r.kmPlan)}`} texto="km hechos / planificados" />
            <Indicador valor={`${r.hechas}/${r.plan}`} texto="sesiones hechas" tono="azul" />
          </div>
          {semana.nota_semana && <Tarjeta>📌 {semana.nota_semana}</Tarjeta>}
          <div className="flex flex-wrap gap-2">
            <AgregarCalendario semana={semana} lunes={lunes} />
            {r.hechas > 0 && (
              <BotonCompartir
                nombreArchivo={`rivero-semana-${lunes}.png`}
                etiqueta="📤 Compartir mi semana"
                generar={(estilo) =>
                  tarjetaLista({
                    estilo,
                    nombre: alumno.nombre,
                    titulo: 'Mi semana',
                    subtitulo: rangoSemana(lunes),
                    destacado: `${formatoKm(r.kmReal)} km · ${r.hechas}/${r.plan} sesiones`,
                    grafico: {
                      titulo: 'Km por día',
                      barras: Array.from({ length: 7 }, (_, i) => {
                        const fecha = sumarDias(lunes, i)
                        const km = semana.sesiones.filter((s) => s.fecha === fecha).reduce((t, s) => t + kmCorridos(s.registro), 0)
                        return { etiqueta: DIAS[i].slice(0, 2), valor: km, texto: km ? formatoKm(km) : '' }
                      }),
                    },
                    filas: semana.sesiones
                      .filter((s) => s.registro)
                      .map((s) => ({
                        icono: s.evaluacion?.resultado === 'cumplio' ? '✅' : '🏃',
                        texto: `${DIAS[diaSemana(s.fecha)]} · ${s.resumen || tipo(s.tipo).nombre}`,
                        valor: s.registro!.distancia_km ? `${formatoKm(s.registro!.distancia_km)} km` : '✓',
                      })),
                  })
                }
              />
            )}
          </div>
          <ListaDias
            lunes={lunes}
            sesiones={semana.sesiones}
            hoy={hoy}
            extras={extras}
            onAgregarExtra={setExtraEn}
            onBorrarExtra={borrarExtra}
            accion={(s) =>
              // Se puede registrar hoy y los días anteriores de la semana que falten.
              s.fecha <= hoy && s.fecha >= sumarDias(hoy, -6) ? (
                <Link
                  to={`/registrar/${s.id}`}
                  className={`flex min-h-11 items-center rounded-xl px-4 text-sm font-semibold ${s.registro ? 'text-azul' : 'bg-azul text-white'}`}
                >
                  {s.registro ? 'Editar' : 'Registrar'}
                </Link>
              ) : null
            }
            extra={(s) => (
              <>
                {s.evaluacion?.comentario ? <p className="rounded-xl bg-fondo px-3 py-2 text-sm">💬 {s.evaluacion.comentario}</p> : null}
                {s.registro ? (
                  <div>
                    <BotonCompartir
                      variante="texto"
                      nombreArchivo="rivero-entrenamiento.png"
                      etiqueta="📤 Compartir entrenamiento"
                      generar={(estilo) =>
                        imagenDeSesion({ estilo, registro: { ...s.registro!, rep_m: s.rep_m ?? null }, tipo: tipo(s.tipo).nombre, titulo: s.resumen || tipo(s.tipo).nombre, nombre: alumno.nombre, planKm: s.distancia_km })
                      }
                    />
                  </div>
                ) : null}
              </>
            )}
          />
        </>
      )}
      <FormExtra alumnoId={alumno.id} fecha={extraEn ?? hoy} abierta={extraEn !== null} onCerrar={() => setExtraEn(null)} onListo={recargarExtras} />
    </Pantalla>
  )
}
