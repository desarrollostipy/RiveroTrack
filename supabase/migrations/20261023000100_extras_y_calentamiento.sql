-- =====================================================================
-- Rivero Track & Field — 18. Actividades extra y calentamiento / afloje
--   * El alumno registra aparte la entrada en calor y el afloje de la
--     sesión principal. El ritmo sigue siendo el de la parte principal;
--     los km de la semana y del ranking suman todo lo corrido.
--   * Actividades extra fuera del plan: natación, bici, gimnasio…
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

-- ---------- Calentamiento y afloje ----------
alter table public.sesiones_registradas
  add column if not exists calentamiento_km  numeric(5,2) check (calentamiento_km > 0),
  add column if not exists calentamiento_min smallint check (calentamiento_min > 0),
  add column if not exists afloje_km         numeric(5,2) check (afloje_km > 0),
  add column if not exists afloje_min        smallint check (afloje_min > 0);

-- La vista semanal ahora suma calentamiento y afloje en los km reales.
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
           filter (where sr.id is not null), 0)                              as km_real,
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

-- El ranking también suma todo lo corrido (solo si ya existe la Etapa 2).
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'alumnos' and column_name = 'en_ranking') then
    execute $f$
      create or replace function public.ranking_mes(p_mes date)
      returns table (alumno_id uuid, nombre text, avatar_url text, km numeric, sesiones integer, dias integer, es_yo boolean, visible boolean)
      language sql stable security definer set search_path = ''
      as $q$
        select a.id, a.nombre, p.avatar_url,
               coalesce(sum(coalesce(s.distancia_km, 0) + coalesce(s.calentamiento_km, 0) + coalesce(s.afloje_km, 0)), 0)::numeric(8,2),
               count(s.id)::integer,
               count(distinct s.fecha)::integer,
               a.profile_id is not distinct from auth.uid(),
               a.en_ranking
          from public.alumnos a
          left join public.profiles p on p.id = a.profile_id
          left join public.sesiones_registradas s
                 on s.alumno_id = a.id
                and s.fecha >= date_trunc('month', p_mes)::date
                and s.fecha < (date_trunc('month', p_mes) + interval '1 month')::date
         where auth.uid() is not null
           and a.activo
           and (a.en_ranking or a.profile_id = auth.uid() or public.es_entrenador())
         group by a.id, a.nombre, p.avatar_url, a.profile_id, a.en_ranking;
      $q$
    $f$;
  end if;
end $$;

-- ---------- Actividades extra ----------
create table if not exists public.actividades_extra (
  id           uuid primary key default gen_random_uuid(),
  alumno_id    uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  fecha        date not null default public.hoy_py(),
  deporte      text not null check (deporte in ('natacion', 'bicicleta', 'gimnasio', 'caminata', 'yoga', 'futbol', 'padel', 'otro')),
  nombre       text check (char_length(nombre) <= 40),          -- para "otro"
  duracion_min smallint not null check (duracion_min between 1 and 1440),
  distancia_km numeric(6,2) check (distancia_km > 0),
  fc_prom      smallint check (fc_prom between 40 and 240),
  sensacion    smallint check (sensacion between 1 and 5),
  comentario   text check (char_length(comentario) <= 300),
  created_at   timestamptz not null default now()
);
create index if not exists actividades_extra_alumno on public.actividades_extra (alumno_id, fecha desc);

alter table public.actividades_extra enable row level security;

drop policy if exists "entrenador: acceso total" on public.actividades_extra;
create policy "entrenador: acceso total" on public.actividades_extra
  for all to authenticated
  using ((select public.es_entrenador())) with check ((select public.es_entrenador()));

drop policy if exists "alumno: gestiona lo suyo" on public.actividades_extra;
create policy "alumno: gestiona lo suyo" on public.actividades_extra
  for all to authenticated
  using (alumno_id = (select public.mi_alumno_id()))
  with check (alumno_id = (select public.mi_alumno_id()));

grant select, insert, update, delete on public.actividades_extra to authenticated;
revoke all on public.actividades_extra from anon;
