-- =====================================================================
-- Rivero Track & Field — 04. Vista v_resumen_semanal
-- Una fila por alumno y semana. No se carga a mano.
-- security_invoker = true: la vista aplica las reglas RLS de quien la
-- consulta (el alumno solo ve sus semanas publicadas).
-- Los días de descanso no cuentan como sesiones planificadas.
-- No incluye datos del ciclo.
-- =====================================================================

-- Km planificados de una sesión. Si solo tiene tiempo ("40 min"), se
-- estiman con el ritmo medio del rango objetivo (40 min a 5:30/km ≈ 7,3 km).
-- Sin distancia ni ritmo, devuelve null (no suma).
create or replace function public.km_planificados(
  p_distancia_km  numeric,
  p_duracion_min  smallint,
  p_ritmo_min_seg smallint,
  p_ritmo_max_seg smallint
)
returns numeric
language sql immutable
as $$
  select coalesce(
    p_distancia_km,
    round(
      p_duracion_min * 60.0
      / nullif((coalesce(p_ritmo_min_seg, p_ritmo_max_seg) + coalesce(p_ritmo_max_seg, p_ritmo_min_seg)) / 2.0, 0),
      1
    )
  );
$$;

grant execute on function public.km_planificados(numeric, smallint, smallint, smallint) to authenticated;

create or replace view public.v_resumen_semanal
with (security_invoker = true)
as
select
  p.alumno_id,
  p.semana_inicio,
  p.estado,
  coalesce(sum(public.km_planificados(sp.distancia_km, sp.duracion_min, sp.ritmo_min_seg, sp.ritmo_max_seg))
           filter (where sp.tipo <> 'descanso'), 0)                          as km_plan,
  coalesce(sum(sr.distancia_km), 0)                                          as km_real,
  count(sp.id) filter (where sp.tipo <> 'descanso')                          as sesiones_plan,
  count(sr.id) filter (where sp.tipo <> 'descanso')                          as sesiones_hechas,
  round(
    100.0 * count(sr.id) filter (where sp.tipo <> 'descanso')
    / nullif(count(sp.id) filter (where sp.tipo <> 'descanso'), 0)
  )::int                                                                     as cumplimiento_pct,
  round(
    sum(sr.duracion_seg) filter (where sr.distancia_km > 0)
    / nullif(sum(sr.distancia_km) filter (where sr.duracion_seg > 0), 0)
  )::int                                                                     as ritmo_prom_seg,
  round(avg(sr.fc_prom))::int                                                as fc_prom,
  count(e.id) filter (where e.resultado = 'cumplio')                         as evaluaciones_ok
from public.planes_semanales p
left join public.sesiones_planificadas sp on sp.plan_id = p.id
left join public.sesiones_registradas  sr on sr.sesion_planificada_id = sp.id
left join public.evaluaciones          e  on e.sesion_planificada_id = sp.id
group by p.id, p.alumno_id, p.semana_inicio, p.estado;

revoke all on public.v_resumen_semanal from anon;
grant select on public.v_resumen_semanal to authenticated;
