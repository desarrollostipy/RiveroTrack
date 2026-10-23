-- =====================================================================
-- Rivero Track & Field — 21. Ciclo menstrual personalizado
--   * Perfil del ciclo de cada alumna (duraciones, regularidad,
--     anticonceptivo hormonal, condiciones, aviso previo, pausa).
--   * Síntomas diarios (flujo, cólicos y otros).
--   * Privacidad por niveles: nada / solo fase y día / fase y síntomas.
-- El entrenador NUNCA edita estos datos: solo lee lo que ella comparte.
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

create table if not exists public.perfil_ciclo (
  alumno_id        uuid primary key default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  duracion_ciclo   smallint check (duracion_ciclo between 18 and 60),   -- lo que ella cree; si no, se aprende
  duracion_periodo smallint check (duracion_periodo between 1 and 12),
  regular          boolean,
  anticonceptivo   text not null default 'ninguno'
                   check (anticonceptivo in ('ninguno', 'pastilla', 'diu_hormonal', 'implante', 'inyeccion', 'anillo_parche', 'diu_cobre')),
  condiciones      text[] not null default '{}'
                   check (condiciones <@ array['sop', 'endometriosis', 'tiroides', 'otra']::text[]),
  aviso_previo     boolean not null default false,
  pausado          boolean not null default false,
  compartir        text not null default 'nada' check (compartir in ('nada', 'fase', 'sintomas')),
  updated_at       timestamptz not null default now()
);

create table if not exists public.sintomas_ciclo (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  fecha      date not null default public.hoy_py(),
  flujo      text check (flujo in ('manchado', 'leve', 'medio', 'abundante')),
  colicos    smallint check (colicos between 0 and 3),                 -- 0 nada … 3 fuertes
  sintomas   text[] not null default '{}'
             check (sintomas <@ array['dolor_cabeza', 'hinchazon', 'sensibilidad', 'cansancio', 'irritabilidad', 'animo_bajo', 'antojos', 'insomnio', 'acne', 'nauseas', 'dolor_espalda']::text[]),
  nota       text check (char_length(nota) <= 300),
  created_at timestamptz not null default now(),
  unique (alumno_id, fecha)
);
create index if not exists sintomas_ciclo_fecha on public.sintomas_ciclo (alumno_id, fecha desc);

-- Las alumnas que comparten síntomas (y no tienen el seguimiento en pausa).
create or replace function public.comparte_sintomas_ciclo(p_alumno_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select a.comparte_ciclo and p.compartir = 'sintomas' and not p.pausado
      from public.alumnos a join public.perfil_ciclo p on p.alumno_id = a.id
     where a.id = p_alumno_id and a.sexo = 'F'
  ), false);
$$;

-- La alumna elige qué compartir; "pausar" deja de compartir sin perder lo elegido.
create or replace function public.set_privacidad_ciclo(p_nivel text, p_pausado boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_alumno uuid := public.mi_alumno_id();
begin
  if v_alumno is null or p_nivel not in ('nada', 'fase', 'sintomas') then raise exception 'Opción no válida'; end if;
  insert into public.perfil_ciclo (alumno_id, compartir, pausado) values (v_alumno, p_nivel, coalesce(p_pausado, false))
  on conflict (alumno_id) do update set compartir = excluded.compartir, pausado = excluded.pausado, updated_at = now();
  update public.alumnos set comparte_ciclo = (p_nivel <> 'nada' and not coalesce(p_pausado, false))
   where id = v_alumno and sexo = 'F';
end $$;

-- Lo mínimo que el entrenador necesita para estimar la fase (nunca el anticonceptivo ni las condiciones).
create or replace function public.info_ciclo_alumna(p_alumno_id uuid)
returns table (nivel text, duracion_ciclo smallint, duracion_periodo smallint, hormonal boolean, irregular boolean)
language sql stable security definer set search_path = ''
as $$
  select p.compartir, p.duracion_ciclo, p.duracion_periodo,
         p.anticonceptivo not in ('ninguno', 'diu_cobre'),
         coalesce(p.regular = false, false) or 'sop' = any (p.condiciones)
    from public.perfil_ciclo p
   where p.alumno_id = p_alumno_id
     and public.es_entrenador()
     and public.comparte_ciclo(p_alumno_id)
     and not p.pausado;
$$;

-- ---------- Reglas de acceso ----------
alter table public.perfil_ciclo enable row level security;
alter table public.sintomas_ciclo enable row level security;

drop policy if exists "alumna: gestiona su perfil de ciclo" on public.perfil_ciclo;
create policy "alumna: gestiona su perfil de ciclo" on public.perfil_ciclo
  for all to authenticated
  using (alumno_id = (select public.mi_alumno_id()))
  with check (alumno_id = (select public.mi_alumno_id()) and exists (select 1 from public.alumnos a where a.id = alumno_id and a.sexo = 'F'));

drop policy if exists "alumna: gestiona sus síntomas" on public.sintomas_ciclo;
create policy "alumna: gestiona sus síntomas" on public.sintomas_ciclo
  for all to authenticated
  using (alumno_id = (select public.mi_alumno_id()))
  with check (alumno_id = (select public.mi_alumno_id()) and exists (select 1 from public.alumnos a where a.id = alumno_id and a.sexo = 'F'));

drop policy if exists "entrenador: ve síntomas compartidos" on public.sintomas_ciclo;
create policy "entrenador: ve síntomas compartidos" on public.sintomas_ciclo
  for select to authenticated
  using ((select public.es_entrenador()) and public.comparte_sintomas_ciclo(alumno_id));

grant select, insert, update, delete on public.perfil_ciclo, public.sintomas_ciclo to authenticated;
revoke all on public.perfil_ciclo, public.sintomas_ciclo from anon;
revoke execute on function public.set_privacidad_ciclo(text, boolean), public.info_ciclo_alumna(uuid), public.comparte_sintomas_ciclo(uuid) from public, anon;
grant execute on function public.set_privacidad_ciclo(text, boolean), public.info_ciclo_alumna(uuid), public.comparte_sintomas_ciclo(uuid) to authenticated;

-- Quien ya compartía su ciclo mantiene "solo fase y día".
insert into public.perfil_ciclo (alumno_id, compartir)
select id, 'fase' from public.alumnos where sexo = 'F' and comparte_ciclo
on conflict (alumno_id) do nothing;
