-- =====================================================================
-- Rivero Track & Field — 15. Herramientas del entrenador y notificaciones
--   * Grupos de alumnos y teléfono en la ficha (recordatorio por WhatsApp)
--   * Plantillas de sesión
--   * Anuncios para todos o para un grupo
--   * Entrenamientos grupales y asistencia
--   * Suscripciones a notificaciones push
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

-- ---------- Grupos ----------
create table if not exists public.grupos (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique check (char_length(trim(nombre)) between 1 and 40),
  color      text not null default '#1446B8' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);

alter table public.alumnos add column if not exists grupo_id uuid references public.grupos (id) on delete set null;
alter table public.alumnos add column if not exists telefono text check (char_length(telefono) <= 30);

-- El grupo del alumno que inició sesión (para ver los anuncios de su grupo).
create or replace function public.mi_grupo_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select grupo_id from public.alumnos where profile_id = auth.uid();
$$;

-- ---------- Plantillas de sesión ----------
create table if not exists public.plantillas_sesion (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null check (char_length(trim(nombre)) between 1 and 60),
  tipo          text not null references public.tipos_sesion (codigo) on update cascade,
  resumen       text,
  distancia_km  numeric(5,2) check (distancia_km > 0),
  duracion_min  smallint check (duracion_min > 0),
  ritmo_min_seg smallint check (ritmo_min_seg > 0),
  ritmo_max_seg smallint check (ritmo_max_seg > 0),
  fc_obj_min    smallint check (fc_obj_min between 60 and 230),
  fc_obj_max    smallint check (fc_obj_max between 60 and 230),
  estructura    text,
  notas         text,
  created_at    timestamptz not null default now()
);

-- ---------- Anuncios ----------
create table if not exists public.anuncios (
  id         uuid primary key default gen_random_uuid(),
  texto      text not null check (char_length(trim(texto)) between 1 and 1000),
  grupo_id   uuid references public.grupos (id) on delete cascade, -- null = para todos
  fijado     boolean not null default false,
  autor_id   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists anuncios_fecha on public.anuncios (created_at desc);

-- ---------- Entrenamientos grupales y asistencia ----------
create table if not exists public.entrenamientos_grupales (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null default public.hoy_py(),
  hora        time,
  lugar       text,
  descripcion text,
  grupo_id    uuid references public.grupos (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists entrenamientos_grupales_fecha on public.entrenamientos_grupales (fecha desc);

-- Una fila = el alumno estuvo presente.
create table if not exists public.asistencias (
  entrenamiento_id uuid not null references public.entrenamientos_grupales (id) on delete cascade,
  alumno_id        uuid not null references public.alumnos (id) on delete cascade,
  primary key (entrenamiento_id, alumno_id)
);
create index if not exists asistencias_alumno on public.asistencias (alumno_id);

-- ---------- Notificaciones push ----------
create table if not exists public.push_suscripciones (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

-- ---------- Reglas de acceso ----------
alter table public.grupos enable row level security;
alter table public.plantillas_sesion enable row level security;
alter table public.anuncios enable row level security;
alter table public.entrenamientos_grupales enable row level security;
alter table public.asistencias enable row level security;
alter table public.push_suscripciones enable row level security;

do $$
declare t text;
begin
  foreach t in array array['grupos', 'plantillas_sesion', 'anuncios', 'entrenamientos_grupales', 'asistencias'] loop
    execute format('drop policy if exists "entrenador: acceso total" on public.%I', t);
    execute format(
      'create policy "entrenador: acceso total" on public.%I for all to authenticated
         using ((select public.es_entrenador())) with check ((select public.es_entrenador()))', t);
  end loop;
end $$;

drop policy if exists "todos: ven los grupos" on public.grupos;
create policy "todos: ven los grupos" on public.grupos for select to authenticated using (true);

drop policy if exists "alumno: ve anuncios para todos o su grupo" on public.anuncios;
create policy "alumno: ve anuncios para todos o su grupo" on public.anuncios
  for select to authenticated
  using (grupo_id is null or grupo_id = (select public.mi_grupo_id()));

drop policy if exists "todos: ven los entrenamientos grupales" on public.entrenamientos_grupales;
create policy "todos: ven los entrenamientos grupales" on public.entrenamientos_grupales
  for select to authenticated using (true);

drop policy if exists "alumno: ve su asistencia" on public.asistencias;
create policy "alumno: ve su asistencia" on public.asistencias
  for select to authenticated using (alumno_id = (select public.mi_alumno_id()));

drop policy if exists "cada uno: sus suscripciones" on public.push_suscripciones;
create policy "cada uno: sus suscripciones" on public.push_suscripciones
  for all to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update, delete on
  public.grupos, public.plantillas_sesion, public.anuncios, public.entrenamientos_grupales,
  public.asistencias, public.push_suscripciones
to authenticated;
revoke all on
  public.grupos, public.plantillas_sesion, public.anuncios, public.entrenamientos_grupales,
  public.asistencias, public.push_suscripciones
from anon;
revoke execute on function public.mi_grupo_id() from public, anon;
grant execute on function public.mi_grupo_id() to authenticated;

-- Anuncios nuevos sin recargar.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'anuncios') then
    alter publication supabase_realtime add table public.anuncios;
  end if;
end $$;


-- Al aceptar una solicitud, el celular que cargó el alumno pasa a su ficha.
create or replace function public.aceptar_solicitud(
  p_solicitud_id     uuid,
  p_nivel            text,
  p_cuota            integer,
  p_dia              smallint,
  p_alumno_existente uuid default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  s          public.solicitudes_alta;
  v_alumno   uuid;
  v_vincular uuid := p_alumno_existente;
begin
  if not public.es_entrenador() then
    raise exception 'Solo el entrenador puede aceptar solicitudes';
  end if;

  select * into s from public.solicitudes_alta where id = p_solicitud_id for update;
  if not found or s.estado <> 'pendiente' then
    raise exception 'Esta solicitud ya fue revisada';
  end if;
  if s.profile_id is null then
    raise exception 'La solicitud no tiene un acceso asociado';
  end if;

  -- ¿Ya hay una ficha con esa CI?
  if v_vincular is null then
    select id into v_vincular from public.alumnos where ci = s.ci;
  end if;

  if v_vincular is not null then
    update public.alumnos
       set profile_id       = s.profile_id,
           ci               = s.ci,
           fecha_nacimiento = coalesce(fecha_nacimiento, s.fecha_nacimiento),
           objetivo         = coalesce(objetivo, s.objetivo),
           altura_cm        = coalesce(altura_cm, s.altura_cm),
           nivel            = coalesce(p_nivel, nivel),
           cuota_mensual    = coalesce(p_cuota, cuota_mensual),
           dia_vencimiento  = coalesce(p_dia, dia_vencimiento),
           telefono         = coalesce(telefono, s.telefono),
           activo           = true
     where id = v_vincular and profile_id is null
    returning id into v_alumno;
    if v_alumno is null then
      raise exception 'Ese alumno ya tiene un acceso a la app';
    end if;
  else
    insert into public.alumnos (profile_id, ci, nombre, sexo, fecha_nacimiento, objetivo, nivel, altura_cm, cuota_mensual, dia_vencimiento, telefono)
    values (s.profile_id, s.ci, s.nombre, s.sexo, s.fecha_nacimiento, s.objetivo,
            coalesce(p_nivel, s.nivel_declarado, 'principiante'), s.altura_cm, p_cuota, p_dia, s.telefono)
    returning id into v_alumno;
  end if;

  if s.peso_kg is not null then
    insert into public.mediciones (alumno_id, fecha, peso_kg, cargado_por)
    values (v_alumno, s.created_at::date, s.peso_kg, s.profile_id);
  end if;

  update public.solicitudes_alta
     set estado = 'aceptada', alumno_id = v_alumno, revisado_at = now()
   where id = p_solicitud_id;

  return v_alumno;
end $$;

