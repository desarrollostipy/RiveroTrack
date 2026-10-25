-- =====================================================================
-- Rivero Track & Field — 24. Competencias de running, pista, natación y ciclismo
--   * Cada competencia tiene su disciplina (por defecto, running).
--   * Las competencias de running y pista con resultado suman sus km a la
--     semana (si ese día no se registró ya la misma carrera como sesión).
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

alter table public.competencias
  add column if not exists disciplina text not null default 'running'
    check (disciplina in ('running', 'pista', 'natacion', 'ciclismo'));

-- Proponer una competencia indicando la disciplina (la versión anterior sigue andando).
create or replace function public.proponer_competencia(
  p_nombre              text,
  p_fecha               date,
  p_distancia_km        numeric,
  p_tiempo_objetivo_seg integer,
  p_lugar               text,
  p_comentario          text,
  p_disciplina          text
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_alumno uuid := public.mi_alumno_id();
  v_id     uuid;
begin
  if v_alumno is null then
    raise exception 'Solo un alumno puede proponer competencias';
  end if;
  if coalesce(trim(p_nombre), '') = '' or p_fecha is null then
    raise exception 'Completá el nombre y la fecha de la competencia';
  end if;
  if coalesce(p_disciplina, 'running') not in ('running', 'pista', 'natacion', 'ciclismo') then
    raise exception 'Disciplina no válida';
  end if;
  insert into public.competencias
    (alumno_id, nombre, fecha, distancia_km, tiempo_objetivo_seg, lugar, comentario_alumno, estado, propuesta_por, prioridad, disciplina)
  values
    (v_alumno, trim(p_nombre), p_fecha, p_distancia_km, p_tiempo_objetivo_seg, nullif(trim(p_lugar), ''), nullif(trim(p_comentario), ''),
     'propuesta', 'alumno', 'B', coalesce(p_disciplina, 'running'))
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.proponer_competencia(text, date, numeric, integer, text, text, text) from public, anon;
grant execute on function public.proponer_competencia(text, date, numeric, integer, text, text, text) to authenticated;

-- Km de competencias corridas (running y pista) en una semana, sin contar dos veces
-- una carrera que el alumno también registró como sesión ese día (distancia parecida).
create or replace function public.km_competencias_semana(p_alumno_id uuid, p_lunes date)
returns numeric
language sql stable security invoker set search_path = ''
as $$
  select coalesce(sum(coalesce(c.resultado_distancia_km, c.distancia_km)), 0)
    from public.competencias c
   where c.alumno_id = p_alumno_id
     and c.fecha between p_lunes and p_lunes + 6
     and c.estado = 'aprobada'
     and c.resultado_tiempo_seg is not null
     and c.disciplina in ('running', 'pista')
     and coalesce(c.resultado_distancia_km, c.distancia_km) > 0
     and not exists (
       select 1 from public.sesiones_registradas sr
        where sr.alumno_id = c.alumno_id
          and sr.fecha = c.fecha
          and abs(coalesce(sr.distancia_km, 0) - coalesce(c.resultado_distancia_km, c.distancia_km))
              <= 0.15 * coalesce(c.resultado_distancia_km, c.distancia_km));
$$;

-- La vista semanal suma también los km de competencias.
create or replace view public.v_resumen_semanal
with (security_invoker = true)
as
select
  p.alumno_id,
  p.semana_inicio,
  p.estado,
  coalesce(sum(public.km_planificados(sp.distancia_km, sp.duracion_min, sp.ritmo_min_seg, sp.ritmo_max_seg))
           filter (where sp.tipo <> 'descanso'), 0)                          as km_plan,
  coalesce(sum(coalesce(sr.distancia_km, 0) + coalesce(sr.calentamiento_km, 0) + coalesce(sr.afloje_km, 0))
           filter (where sr.id is not null), 0)
    + public.km_competencias_semana(p.alumno_id, p.semana_inicio)            as km_real,
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
revoke execute on function public.km_competencias_semana(uuid, date) from public, anon;
grant execute on function public.km_competencias_semana(uuid, date) to authenticated;
