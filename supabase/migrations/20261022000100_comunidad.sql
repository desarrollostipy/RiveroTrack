-- =====================================================================
-- Rivero Track & Field — 17. Motivación y comunidad (Etapa 2)
--   * Ranking mensual del equipo (cada alumno elige si aparece)
--   * Desafíos del mes (insignias de temporada)
--   * Eventos del grupo con cupo e inscripción
--   * Plantillas de mensajes masivos
--   * Hora de largada de las competencias (modo carrera)
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

-- ---------- Ranking ----------
alter table public.alumnos add column if not exists en_ranking boolean not null default true;

create or replace function public.set_mi_ranking(p_visible boolean)
returns void
language sql security definer set search_path = ''
as $$
  update public.alumnos set en_ranking = p_visible where profile_id = auth.uid();
$$;

-- Km, sesiones y días entrenados en un mes. Cada alumno ve a los que eligieron
-- aparecer (y a sí mismo); el entrenador ve a todos. Nunca expone otros datos.
create or replace function public.ranking_mes(p_mes date)
returns table (alumno_id uuid, nombre text, avatar_url text, km numeric, sesiones integer, dias integer, es_yo boolean, visible boolean)
language sql stable security definer set search_path = ''
as $$
  select a.id, a.nombre, p.avatar_url,
         coalesce(sum(s.distancia_km), 0)::numeric(8,2),
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
$$;

-- ---------- Desafíos del mes ----------
create table if not exists public.desafios (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(trim(titulo)) between 1 and 60),
  emoji       text not null default '🏅' check (char_length(emoji) <= 8),
  descripcion text check (char_length(descripcion) <= 200),
  mes         date not null check (extract(day from mes) = 1),
  tipo        text not null check (tipo in ('km', 'sesiones', 'dias', 'grupales')),
  meta        numeric(7,1) not null check (meta > 0),
  grupo_id    uuid references public.grupos (id) on delete cascade, -- null = para todos
  created_at  timestamptz not null default now()
);
create index if not exists desafios_mes on public.desafios (mes desc);

-- ---------- Eventos del grupo ----------
create table if not exists public.eventos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(trim(titulo)) between 1 and 80),
  descripcion text check (char_length(descripcion) <= 1000),
  fecha       date not null,
  hora        time,
  lugar       text check (char_length(lugar) <= 120),
  cupo        smallint check (cupo > 0),          -- null = sin límite
  costo       integer check (costo >= 0),         -- en guaraníes; null = gratis
  cierre      date,                               -- último día para anotarse
  grupo_id    uuid references public.grupos (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists eventos_fecha on public.eventos (fecha);

create table if not exists public.inscripciones_evento (
  evento_id  uuid not null references public.eventos (id) on delete cascade,
  alumno_id  uuid not null references public.alumnos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evento_id, alumno_id)
);
create index if not exists inscripciones_alumno on public.inscripciones_evento (alumno_id);

-- Anotarse: controla que el evento sea para su grupo, que no haya cerrado y que haya cupo.
create or replace function public.inscribirme_evento(p_evento_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e        public.eventos;
  v_alumno uuid := public.mi_alumno_id();
  v_cant   integer;
begin
  if v_alumno is null then raise exception 'Solo los alumnos se pueden anotar'; end if;
  select * into e from public.eventos where id = p_evento_id for update;
  if not found or (e.grupo_id is not null and e.grupo_id is distinct from public.mi_grupo_id()) then
    raise exception 'Evento no encontrado';
  end if;
  if e.fecha < public.hoy_py() or (e.cierre is not null and e.cierre < public.hoy_py()) then
    raise exception 'Las inscripciones ya cerraron';
  end if;
  select count(*) into v_cant from public.inscripciones_evento where evento_id = p_evento_id;
  if e.cupo is not null and v_cant >= e.cupo then
    raise exception 'No quedan lugares';
  end if;
  insert into public.inscripciones_evento (evento_id, alumno_id) values (p_evento_id, v_alumno)
  on conflict do nothing;
end $$;

-- Cuántos anotados tiene cada evento visible y si el que pregunta está anotado.
create or replace function public.cupos_eventos()
returns table (evento_id uuid, anotados integer, yo boolean)
language sql stable security definer set search_path = ''
as $$
  select e.id,
         (select count(*) from public.inscripciones_evento i where i.evento_id = e.id)::integer,
         exists (select 1 from public.inscripciones_evento i where i.evento_id = e.id and i.alumno_id = public.mi_alumno_id())
    from public.eventos e
   where auth.uid() is not null
     and (public.es_entrenador() or e.grupo_id is null or e.grupo_id = public.mi_grupo_id());
$$;

-- ---------- Plantillas de mensajes masivos ----------
create table if not exists public.plantillas_mensaje (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (char_length(trim(titulo)) between 1 and 60),
  texto      text not null check (char_length(trim(texto)) between 1 and 1000),
  created_at timestamptz not null default now()
);

-- ---------- Modo carrera ----------
alter table public.competencias add column if not exists hora_largada time;

-- ---------- Reglas de acceso ----------
alter table public.desafios enable row level security;
alter table public.eventos enable row level security;
alter table public.inscripciones_evento enable row level security;
alter table public.plantillas_mensaje enable row level security;

do $$
declare t text;
begin
  foreach t in array array['desafios', 'eventos', 'inscripciones_evento', 'plantillas_mensaje'] loop
    execute format('drop policy if exists "entrenador: acceso total" on public.%I', t);
    execute format(
      'create policy "entrenador: acceso total" on public.%I for all to authenticated
         using ((select public.es_entrenador())) with check ((select public.es_entrenador()))', t);
  end loop;
end $$;

drop policy if exists "alumno: ve desafíos para todos o su grupo" on public.desafios;
create policy "alumno: ve desafíos para todos o su grupo" on public.desafios
  for select to authenticated
  using (grupo_id is null or grupo_id = (select public.mi_grupo_id()));

drop policy if exists "alumno: ve eventos para todos o su grupo" on public.eventos;
create policy "alumno: ve eventos para todos o su grupo" on public.eventos
  for select to authenticated
  using (grupo_id is null or grupo_id = (select public.mi_grupo_id()));

-- Anotarse es solo con inscribirme_evento(); darse de baja, directo.
drop policy if exists "alumno: ve sus inscripciones" on public.inscripciones_evento;
create policy "alumno: ve sus inscripciones" on public.inscripciones_evento
  for select to authenticated using (alumno_id = (select public.mi_alumno_id()));
drop policy if exists "alumno: se da de baja" on public.inscripciones_evento;
create policy "alumno: se da de baja" on public.inscripciones_evento
  for delete to authenticated using (alumno_id = (select public.mi_alumno_id()));

grant select, insert, update, delete on public.desafios, public.eventos, public.inscripciones_evento, public.plantillas_mensaje to authenticated;
revoke all on public.desafios, public.eventos, public.inscripciones_evento, public.plantillas_mensaje from anon;

revoke execute on function public.set_mi_ranking(boolean) from public, anon;
revoke execute on function public.ranking_mes(date) from public, anon;
revoke execute on function public.inscribirme_evento(uuid) from public, anon;
revoke execute on function public.cupos_eventos() from public, anon;
grant execute on function public.set_mi_ranking(boolean), public.ranking_mes(date), public.inscribirme_evento(uuid), public.cupos_eventos() to authenticated;
