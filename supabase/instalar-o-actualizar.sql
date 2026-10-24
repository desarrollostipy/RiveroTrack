-- =====================================================================
-- RIVERO TRACK & FIELD — INSTALADOR / ACTUALIZADOR DE LA BASE DE DATOS
--
-- Pegar ENTERO en Supabase → SQL Editor → Run.
-- Se puede correr las veces que haga falta: lo que ya existe no se toca
-- y lo que falta se crea. Incluye todo lo agregado después de la
-- instalación inicial (pagos, registro de alumnos, CI única, pulso,
-- competencias, velocidad, perfil y chat, fotos, herramientas, avisos,
-- salud y seguimiento, ranking, desafíos, eventos y mensajes).
-- =====================================================================

-- >>>>> 20261017000100_registrar_pago.sql
-- =====================================================================
-- Rivero Track & Field — 07. Registrar un pago (Etapa 1)
-- Crea el pago y salda las cuotas indicadas en un solo paso: o se
-- guarda todo o no se guarda nada. Un pago puede saldar varias cuotas.
-- Corre con los permisos de quien la llama: RLS exige que sea el entrenador.
-- =====================================================================

create or replace function public.registrar_pago(
  p_alumno_id  uuid,
  p_fecha      date,
  p_monto      integer,
  p_medio      text,
  p_referencia text,
  p_cuota_ids  uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_pago uuid;
begin
  if not public.es_entrenador() then
    raise exception 'Solo el entrenador puede registrar pagos';
  end if;

  insert into public.pagos (alumno_id, fecha, monto, medio, referencia)
  values (p_alumno_id, coalesce(p_fecha, public.hoy_py()), p_monto, p_medio, p_referencia)
  returning id into v_pago;

  update public.cuotas
     set pago_id = v_pago
   where alumno_id = p_alumno_id
     and id = any (coalesce(p_cuota_ids, '{}'))
     and pago_id is null;

  return v_pago;
end $$;

revoke execute on function public.registrar_pago(uuid, date, integer, text, text, uuid[]) from public, anon;
grant  execute on function public.registrar_pago(uuid, date, integer, text, text, uuid[]) to authenticated;


-- >>>>> 20261018000100_solicitudes_alta.sql
-- =====================================================================
-- Rivero Track & Field — 08. Registro de alumnos nuevos
-- El alumno se registra solo desde la pantalla de ingreso (con su CI y
-- un PIN que elige). Queda como solicitud pendiente: puede iniciar
-- sesión, pero no ve nada hasta que el entrenador la acepta y le carga
-- los datos de la cuota.
-- La solicitud la crea la función de Netlify gestionar-acceso.
-- =====================================================================

create table if not exists public.solicitudes_alta (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid unique references public.profiles (id) on delete set null,
  ci               text not null check (ci ~ '^[0-9]{4,10}$'),
  nombre           text not null,
  sexo             text not null check (sexo in ('F', 'M')),
  fecha_nacimiento date,
  telefono         text,
  objetivo         text,
  nivel_declarado  text check (nivel_declarado in ('principiante', 'intermedio', 'avanzado')),
  altura_cm        smallint check (altura_cm between 100 and 230),
  peso_kg          numeric(4,1) check (peso_kg between 25 and 250),
  comentario       text,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  alumno_id        uuid references public.alumnos (id) on delete set null,
  created_at       timestamptz not null default now(),
  revisado_at      timestamptz
);

-- Una sola solicitud pendiente por CI.
create unique index if not exists solicitudes_alta_ci_pendiente on public.solicitudes_alta (ci) where estado = 'pendiente';

alter table public.solicitudes_alta enable row level security;

drop policy if exists "entrenador: acceso total" on public.solicitudes_alta;
create policy "entrenador: acceso total" on public.solicitudes_alta
  for all to authenticated
  using ((select public.es_entrenador()))
  with check ((select public.es_entrenador()));

drop policy if exists "alumno: ve su solicitud" on public.solicitudes_alta;
create policy "alumno: ve su solicitud" on public.solicitudes_alta
  for select to authenticated
  using (profile_id = (select auth.uid()));

grant select, insert, update, delete on public.solicitudes_alta to authenticated;
revoke all on public.solicitudes_alta from anon;


-- Aceptar: crea la ficha del alumno (o completa una ya cargada a mano,
-- si se indica p_alumno_existente) y la vincula al acceso que ya tiene.
-- La cuota del mes se genera sola al dar de alta (trigger de alumnos).
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
  s        public.solicitudes_alta;
  v_alumno uuid;
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

  if p_alumno_existente is not null then
    update public.alumnos
       set profile_id       = s.profile_id,
           fecha_nacimiento = coalesce(fecha_nacimiento, s.fecha_nacimiento),
           objetivo         = coalesce(objetivo, s.objetivo),
           altura_cm        = coalesce(altura_cm, s.altura_cm),
           nivel            = coalesce(p_nivel, nivel),
           cuota_mensual    = coalesce(p_cuota, cuota_mensual),
           dia_vencimiento  = coalesce(p_dia, dia_vencimiento),
           activo           = true
     where id = p_alumno_existente and profile_id is null
    returning id into v_alumno;
    if v_alumno is null then
      raise exception 'Ese alumno ya tiene un acceso a la app';
    end if;
  else
    insert into public.alumnos (profile_id, nombre, sexo, fecha_nacimiento, objetivo, nivel, altura_cm, cuota_mensual, dia_vencimiento)
    values (s.profile_id, s.nombre, s.sexo, s.fecha_nacimiento, s.objetivo,
            coalesce(p_nivel, s.nivel_declarado, 'principiante'), s.altura_cm, p_cuota, p_dia)
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

revoke execute on function public.aceptar_solicitud(uuid, text, integer, smallint, uuid) from public, anon;
grant  execute on function public.aceptar_solicitud(uuid, text, integer, smallint, uuid) to authenticated;


-- >>>>> 20261018000200_ci_unica.sql
-- =====================================================================
-- Rivero Track & Field — 09. Una CI = un alumno
-- La ficha guarda la CI aunque el alumno todavía no tenga acceso, y no
-- puede haber dos fichas con la misma CI. Si alguien se registra con la
-- CI de una ficha ya cargada, al aceptarlo se vincula a esa ficha.
-- =====================================================================

alter table public.alumnos add column if not exists ci text check (ci ~ '^[0-9]{4,10}$');

-- Completar con la CI de los que ya tienen acceso.
update public.alumnos a set ci = p.ci from public.profiles p where p.id = a.profile_id and a.ci is null;

create unique index if not exists alumnos_ci_unica on public.alumnos (ci) where ci is not null;


-- Aceptar solicitud: ahora también vincula sola la ficha con la misma CI.
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
           activo           = true
     where id = v_vincular and profile_id is null
    returning id into v_alumno;
    if v_alumno is null then
      raise exception 'Ese alumno ya tiene un acceso a la app';
    end if;
  else
    insert into public.alumnos (profile_id, ci, nombre, sexo, fecha_nacimiento, objetivo, nivel, altura_cm, cuota_mensual, dia_vencimiento)
    values (s.profile_id, s.ci, s.nombre, s.sexo, s.fecha_nacimiento, s.objetivo,
            coalesce(p_nivel, s.nivel_declarado, 'principiante'), s.altura_cm, p_cuota, p_dia)
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


-- >>>>> 20261019000100_pulso_objetivo.sql
-- =====================================================================
-- Rivero Track & Field — 10. Pulso objetivo por sesión
-- Ejemplo: rodaje a 130 ppm (un valor) o de 125 a 135 ppm (rango).
-- Si se carga un solo valor, va en fc_obj_max ("hasta 130 ppm").
-- =====================================================================

alter table public.sesiones_planificadas
  add column if not exists fc_obj_min smallint check (fc_obj_min between 60 and 230),
  add column if not exists fc_obj_max smallint check (fc_obj_max between 60 and 230);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sesiones_planificadas_fc_rango') then
    alter table public.sesiones_planificadas
      add constraint sesiones_planificadas_fc_rango check (fc_obj_min is null or fc_obj_max is null or fc_obj_min <= fc_obj_max);
  end if;
end $$;


-- >>>>> 20261019000200_competencias_alumno.sql
-- =====================================================================
-- Rivero Track & Field — 11. Competencias propuestas por el alumno
-- El alumno propone una carrera; el entrenador la aprueba o no (con un
-- comentario). Después de correrla se carga el resultado y queda como
-- historial para los dos. Las que carga el entrenador nacen aprobadas.
-- =====================================================================

alter table public.competencias
  add column if not exists estado                text not null default 'aprobada' check (estado in ('propuesta', 'aprobada', 'rechazada')),
  add column if not exists propuesta_por         text not null default 'entrenador' check (propuesta_por in ('alumno', 'entrenador')),
  add column if not exists lugar                 text,
  add column if not exists comentario_alumno     text,
  add column if not exists comentario_entrenador text,
  add column if not exists respondida_at         timestamptz,
  add column if not exists resultado_tiempo_seg  integer check (resultado_tiempo_seg > 0),
  add column if not exists resultado_posicion    text,
  add column if not exists resultado_comentario  text,
  add column if not exists resultado_link        text,
  add column if not exists created_at            timestamptz not null default now();

create index if not exists competencias_estado_idx on public.competencias (estado);

-- El alumno puede retirar una propuesta que todavía no se respondió.
drop policy if exists "alumno: borra su propuesta" on public.competencias;
create policy "alumno: borra su propuesta" on public.competencias
  for delete to authenticated
  using (alumno_id = (select public.mi_alumno_id()) and estado = 'propuesta');


-- El alumno propone una competencia (queda pendiente de aprobación).
create or replace function public.proponer_competencia(
  p_nombre              text,
  p_fecha               date,
  p_distancia_km        numeric,
  p_tiempo_objetivo_seg integer,
  p_lugar               text,
  p_comentario          text
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
  insert into public.competencias
    (alumno_id, nombre, fecha, distancia_km, tiempo_objetivo_seg, lugar, comentario_alumno, estado, propuesta_por, prioridad)
  values
    (v_alumno, trim(p_nombre), p_fecha, p_distancia_km, p_tiempo_objetivo_seg, nullif(trim(p_lugar), ''), nullif(trim(p_comentario), ''),
     'propuesta', 'alumno', 'B')
  returning id into v_id;
  return v_id;
end $$;


-- Resultado de una competencia aprobada que ya se corrió.
-- Lo puede cargar el alumno (la suya) o el entrenador.
create or replace function public.cargar_resultado_competencia(
  p_competencia_id uuid,
  p_tiempo_seg     integer,
  p_posicion       text,
  p_comentario     text,
  p_link           text
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.competencias
     set resultado_tiempo_seg = p_tiempo_seg,
         resultado_posicion   = nullif(trim(p_posicion), ''),
         resultado_comentario = nullif(trim(p_comentario), ''),
         resultado_link       = nullif(trim(p_link), '')
   where id = p_competencia_id
     and estado = 'aprobada'
     and fecha <= public.hoy_py()
     and (alumno_id = public.mi_alumno_id() or public.es_entrenador());
  if not found then
    raise exception 'Solo se puede cargar el resultado de una competencia aprobada que ya se corrió';
  end if;
end $$;

revoke execute on function
  public.proponer_competencia(text, date, numeric, integer, text, text),
  public.cargar_resultado_competencia(uuid, integer, text, text, text)
from public, anon;

grant execute on function
  public.proponer_competencia(text, date, numeric, integer, text, text),
  public.cargar_resultado_competencia(uuid, integer, text, text, text)
to authenticated;


-- >>>>> 20261019000300_semanas_rapidas.sql
-- =====================================================================
-- Rivero Track & Field — 12. Semanas de un alumno en una sola consulta
-- Antes, la app pedía planes → sesiones → registros → evaluaciones y la
-- base revisaba las reglas de acceso (RLS) en cada nivel y cada fila.
-- Esta función verifica el permiso UNA vez y devuelve todo junto.
--   * Entrenador: cualquier alumno, también planes en borrador.
--   * Alumno: solo sus propias semanas, y solo las publicadas.
-- =====================================================================

create or replace function public.semanas_completas(p_alumno_id uuid, p_desde date, p_hasta date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_entrenador boolean := public.es_entrenador();
begin
  if not v_entrenador and p_alumno_id is distinct from public.mi_alumno_id() then
    raise exception 'No tenés permiso para ver estas semanas';
  end if;

  return coalesce((
    select jsonb_agg(
             to_jsonb(p) || jsonb_build_object('sesiones', coalesce((
               select jsonb_agg(
                        to_jsonb(sp) || jsonb_build_object(
                          'registro',   (select to_jsonb(r) from public.sesiones_registradas r where r.sesion_planificada_id = sp.id),
                          'evaluacion', (select to_jsonb(e) from public.evaluaciones e where e.sesion_planificada_id = sp.id)
                        )
                        order by sp.fecha, sp.turno)
                 from public.sesiones_planificadas sp
                where sp.plan_id = p.id), '[]'::jsonb))
             order by p.semana_inicio)
      from public.planes_semanales p
     where p.alumno_id = p_alumno_id
       and p.semana_inicio between p_desde and p_hasta
       and (v_entrenador or p.estado = 'publicado')
  ), '[]'::jsonb);
end $$;

revoke execute on function public.semanas_completas(uuid, date, date) from public, anon;
grant  execute on function public.semanas_completas(uuid, date, date) to authenticated;


-- >>>>> 20261019000400_perfil_y_chat.sql
-- =====================================================================
-- Rivero Track & Field — 13. Mi perfil (foto + estado) y chat
-- =====================================================================

-- ---------- Perfil: foto y "estado" (como las notas de Instagram) ----------
alter table public.profiles
  add column if not exists avatar_url     text,
  add column if not exists estado_emoji   text check (char_length(estado_emoji) <= 16),
  add column if not exists estado_texto   text check (char_length(estado_texto) <= 80),
  add column if not exists estado_cancion text check (char_length(estado_cancion) <= 80),
  add column if not exists estado_at      timestamptz;

-- Cada uno cambia SOLO su foto y su estado (no puede tocar su rol ni su CI).
create or replace function public.set_mi_avatar(p_url text)
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set avatar_url = nullif(trim(p_url), '') where id = auth.uid();
$$;

create or replace function public.set_mi_estado(p_emoji text, p_texto text, p_cancion text)
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles
     set estado_emoji   = nullif(trim(p_emoji), ''),
         estado_texto   = nullif(trim(p_texto), ''),
         estado_cancion = nullif(trim(p_cancion), ''),
         estado_at      = case when coalesce(trim(p_emoji), trim(p_texto), trim(p_cancion), '') = '' then null else now() end
   where id = auth.uid();
$$;

-- El alumno ve el nombre y la foto de su entrenador (para el chat).
create or replace function public.perfil_entrenador()
returns table (id uuid, nombre text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select id, nombre, avatar_url from public.profiles where rol = 'entrenador' limit 1;
$$;


-- ---------- Chat: una conversación por alumno con el entrenador ----------
create table if not exists public.mensajes (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null references public.alumnos (id) on delete cascade,
  autor_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  texto      text not null check (char_length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now(),
  leido_at   timestamptz
);

create index if not exists mensajes_alumno_id_created_at_idx on public.mensajes (alumno_id, created_at desc);
create index if not exists mensajes_leido_at_idx on public.mensajes (leido_at) where leido_at is null;

-- El autor es siempre quien envía (no se puede firmar como otro).
create or replace function public.mensajes_autor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.autor_id := auth.uid();
  end if;
  new.leido_at := null;
  return new;
end $$;

drop trigger if exists mensajes_autor on public.mensajes;
create trigger mensajes_autor before insert on public.mensajes
  for each row execute function public.mensajes_autor();

alter table public.mensajes enable row level security;

drop policy if exists "entrenador: todos los chats" on public.mensajes;
create policy "entrenador: todos los chats" on public.mensajes
  for all to authenticated
  using ((select public.es_entrenador()))
  with check ((select public.es_entrenador()));

drop policy if exists "alumno: lee su chat" on public.mensajes;
create policy "alumno: lee su chat" on public.mensajes
  for select to authenticated
  using (alumno_id = (select public.mi_alumno_id()));

drop policy if exists "alumno: escribe en su chat" on public.mensajes;
create policy "alumno: escribe en su chat" on public.mensajes
  for insert to authenticated
  with check (alumno_id = (select public.mi_alumno_id()) and autor_id = (select auth.uid()));

grant select, insert, update, delete on public.mensajes to authenticated;
revoke all on public.mensajes from anon;

-- Marcar como leídos los mensajes del otro.
create or replace function public.marcar_chat_leido(p_alumno_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.mensajes
     set leido_at = now()
   where alumno_id = p_alumno_id
     and autor_id <> auth.uid()
     and leido_at is null
     and (public.es_entrenador() or p_alumno_id = public.mi_alumno_id());
$$;

revoke execute on function
  public.set_mi_avatar(text), public.set_mi_estado(text, text, text),
  public.perfil_entrenador(), public.marcar_chat_leido(uuid)
from public, anon;
grant execute on function
  public.set_mi_avatar(text), public.set_mi_estado(text, text, text),
  public.perfil_entrenador(), public.marcar_chat_leido(uuid)
to authenticated;

-- Mensajes nuevos sin recargar.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mensajes') then
    alter publication supabase_realtime add table public.mensajes;
  end if;
end $$;


-- >>>>> 20261019000500_storage_avatares.sql
-- =====================================================================
-- Rivero Track & Field — 14. Fotos de perfil (Supabase Storage)
-- Carpeta "avatares": cada usuario sube su foto dentro de una carpeta con
-- su propio id. Las fotos se ven por link (nombre de archivo aleatorio).
-- Máximo 2 MB; la app las achica antes de subirlas.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatares: subir la propia" on storage.objects;
create policy "avatares: subir la propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares: cambiar la propia" on storage.objects;
create policy "avatares: cambiar la propia" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatares: borrar la propia" on storage.objects;
create policy "avatares: borrar la propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- >>>>> 20261019000600_herramientas.sql
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



-- >>>>> 20261021000100_salud_y_seguimiento.sql
-- =====================================================================
-- Rivero Track & Field — 16. Salud y seguimiento (Etapa 1)
--   * Diario de bienestar (sueño, energía, dolor y ánimo)
--   * Molestias con zona del cuerpo
--   * Zapatillas y sus kilómetros
--   * Metas personales
--   * Ficha médica y contacto de emergencia
--   * Pulso máximo y de reposo que puede cargar el propio alumno
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

-- ---------- Pulso del alumno ----------
alter table public.alumnos add column if not exists fc_reposo smallint check (fc_reposo between 30 and 120);

-- El alumno puede cargar su pulso máximo y de reposo (por ejemplo, de su reloj).
create or replace function public.set_mi_pulso(p_fc_max smallint, p_fc_reposo smallint)
returns void
language sql security definer set search_path = ''
as $$
  update public.alumnos
     set fc_max = p_fc_max, fc_reposo = p_fc_reposo
   where profile_id = auth.uid();
$$;

-- ---------- Diario de bienestar (uno por día) ----------
create table if not exists public.bienestar_diario (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  fecha      date not null default public.hoy_py(),
  sueno      smallint not null check (sueno between 1 and 5),   -- 1 muy mal … 5 excelente
  energia    smallint not null check (energia between 1 and 5),
  dolor      smallint not null check (dolor between 1 and 5),   -- 1 nada … 5 mucho
  animo      smallint not null check (animo between 1 and 5),
  nota       text check (char_length(nota) <= 300),
  created_at timestamptz not null default now(),
  unique (alumno_id, fecha)
);
create index if not exists bienestar_fecha on public.bienestar_diario (fecha desc);

-- ---------- Molestias ----------
create table if not exists public.molestias (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  fecha       date not null default public.hoy_py(),
  zona        text not null check (zona in (
                'cuello', 'hombro', 'espalda_alta', 'lumbar', 'cadera', 'gluteo', 'ingle',
                'cuadriceps', 'isquiotibiales', 'rodilla', 'tibia', 'gemelo', 'aquiles',
                'tobillo', 'pie', 'otra')),
  lado        text check (lado in ('izq', 'der', 'ambos')),
  intensidad  smallint not null check (intensidad between 1 and 10),
  nota        text check (char_length(nota) <= 300),
  resuelta_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists molestias_alumno on public.molestias (alumno_id, fecha desc);

-- ---------- Zapatillas ----------
create table if not exists public.calzado (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 60),
  km_inicial numeric(6,1) not null default 0 check (km_inicial >= 0),
  limite_km  smallint not null default 700 check (limite_km between 100 and 2000),
  principal  boolean not null default false,
  retirada   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists calzado_alumno on public.calzado (alumno_id);

alter table public.sesiones_registradas
  add column if not exists calzado_id uuid references public.calzado (id) on delete set null;

-- Kilómetros de cada par: los iniciales más las sesiones registradas con él.
create or replace view public.v_calzado_km
with (security_invoker = true) as
select c.*,
       c.km_inicial + coalesce((select sum(s.distancia_km) from public.sesiones_registradas s where s.calzado_id = c.id), 0) as km_total
  from public.calzado c;

-- ---------- Metas personales ----------
create table if not exists public.metas_personales (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  titulo         text not null check (char_length(trim(titulo)) between 1 and 80),
  tipo           text not null check (tipo in ('tiempo', 'km', 'libre')),
  distancia      text check (distancia in ('5K', '10K', '21K', '42K')), -- para tipo 'tiempo'
  objetivo_seg   integer check (objetivo_seg > 0),                     -- para tipo 'tiempo'
  objetivo_km    numeric(7,1) check (objetivo_km > 0),                 -- para tipo 'km'
  desde          date not null default public.hoy_py(),
  fecha_limite   date,
  cumplida_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists metas_alumno on public.metas_personales (alumno_id);

-- ---------- Ficha médica y contacto de emergencia ----------
create table if not exists public.fichas_medicas (
  alumno_id         uuid primary key default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  grupo_sanguineo   text check (grupo_sanguineo in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  alergias          text check (char_length(alergias) <= 300),
  condiciones       text check (char_length(condiciones) <= 300),
  medicacion        text check (char_length(medicacion) <= 300),
  seguro_medico     text check (char_length(seguro_medico) <= 100),
  contacto_nombre   text check (char_length(contacto_nombre) <= 80),
  contacto_relacion text check (char_length(contacto_relacion) <= 40),
  contacto_telefono text check (char_length(contacto_telefono) <= 30),
  updated_at        timestamptz not null default now()
);

-- ---------- Reglas de acceso ----------
-- El alumno gestiona lo suyo; el entrenador ve y gestiona todo.
alter table public.bienestar_diario enable row level security;
alter table public.molestias enable row level security;
alter table public.calzado enable row level security;
alter table public.metas_personales enable row level security;
alter table public.fichas_medicas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bienestar_diario', 'molestias', 'calzado', 'metas_personales', 'fichas_medicas'] loop
    execute format('drop policy if exists "entrenador: acceso total" on public.%I', t);
    execute format(
      'create policy "entrenador: acceso total" on public.%I for all to authenticated
         using ((select public.es_entrenador())) with check ((select public.es_entrenador()))', t);
    execute format('drop policy if exists "alumno: gestiona lo suyo" on public.%I', t);
    execute format(
      'create policy "alumno: gestiona lo suyo" on public.%I for all to authenticated
         using (alumno_id = (select public.mi_alumno_id()))
         with check (alumno_id = (select public.mi_alumno_id()))', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.bienestar_diario, public.molestias, public.calzado, public.metas_personales, public.fichas_medicas
to authenticated;
grant select on public.v_calzado_km to authenticated;
revoke all on
  public.bienestar_diario, public.molestias, public.calzado, public.metas_personales, public.fichas_medicas,
  public.v_calzado_km
from anon;
revoke execute on function public.set_mi_pulso(smallint, smallint) from public, anon;
grant execute on function public.set_mi_pulso(smallint, smallint) to authenticated;


-- >>>>> 20261022000100_comunidad.sql
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


-- >>>>> 20261023000100_extras_y_calentamiento.sql
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


-- >>>>> 20261024000100_pista_cobros_seguridad.sql
-- =====================================================================
-- Rivero Track & Field — 19. Pista, cobros y seguridad
--   * Sesiones por repeticiones (pista / series): 15×400 en 1:44–1:48,
--     recuperación 1:30 trotando. El alumno carga repeticiones hechas y
--     vuelta promedio.
--   * Pago de cuotas con comprobante: el alumno lo sube y el entrenador
--     lo aprueba (queda registrado el pago y saldadas las cuotas).
--   * Seguridad: enlaces solo https, largo máximo de los textos libres y
--     aceptación de privacidad en las solicitudes de alta.
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

-- ---------- Repeticiones ----------
do $$
declare t text;
begin
  foreach t in array array['sesiones_planificadas', 'plantillas_sesion'] loop
    execute format('alter table public.%I
      add column if not exists reps        smallint check (reps between 1 and 100),
      add column if not exists rep_m       smallint check (rep_m between 50 and 10000),
      add column if not exists rep_seg_min smallint check (rep_seg_min between 5 and 3600),
      add column if not exists rep_seg_max smallint check (rep_seg_max between 5 and 3600),
      add column if not exists rec_seg     smallint check (rec_seg between 0 and 1800),
      add column if not exists rec_tipo    text check (rec_tipo in (''trote'', ''caminando'', ''parado''))', t);
  end loop;
end $$;

alter table public.sesiones_registradas
  add column if not exists reps_hechas  smallint check (reps_hechas between 0 and 100),
  add column if not exists rep_prom_seg smallint check (rep_prom_seg between 5 and 3600);

-- ---------- Comprobantes de pago ----------
create table if not exists public.comprobantes_pago (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  cuota_ids      uuid[] not null check (cardinality(cuota_ids) between 1 and 12),
  monto          integer not null check (monto > 0),
  fecha          date not null default public.hoy_py(),
  referencia     text check (char_length(referencia) <= 80),
  archivo        text not null check (char_length(archivo) <= 300),  -- ruta en el depósito "comprobantes"
  estado         text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  motivo         text check (char_length(motivo) <= 300),
  pago_id        uuid references public.pagos (id) on delete set null,
  revisado_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists comprobantes_estado on public.comprobantes_pago (estado, created_at desc);

-- Al cargarlo: las cuotas tienen que ser del alumno y estar pendientes,
-- y el archivo tiene que estar en su propia carpeta.
create or replace function public.comprobante_valido()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_perfil uuid;
begin
  if tg_op = 'INSERT' then
    new.estado := 'pendiente';
    new.pago_id := null;
    new.revisado_at := null;
    new.motivo := null;
  end if;
  if exists (
    select 1 from unnest(new.cuota_ids) c(id)
     where not exists (select 1 from public.cuotas q where q.id = c.id and q.alumno_id = new.alumno_id and (q.pago_id is null or tg_op = 'UPDATE'))
  ) then
    raise exception 'Alguna cuota no es tuya o ya está paga';
  end if;
  select profile_id into v_perfil from public.alumnos where id = new.alumno_id;
  if split_part(new.archivo, '/', 1) is distinct from v_perfil::text then
    raise exception 'El archivo del comprobante no es válido';
  end if;
  return new;
end $$;

drop trigger if exists comprobante_valido on public.comprobantes_pago;
create trigger comprobante_valido before insert or update of cuota_ids, archivo, alumno_id on public.comprobantes_pago
  for each row execute function public.comprobante_valido();

-- Aprobar: registra el pago con la función de siempre y salda las cuotas.
create or replace function public.aprobar_comprobante(p_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  c      public.comprobantes_pago;
  v_pago uuid;
begin
  if not public.es_entrenador() then raise exception 'Solo el entrenador puede aprobar pagos'; end if;
  select * into c from public.comprobantes_pago where id = p_id for update;
  if not found or c.estado <> 'pendiente' then raise exception 'Este comprobante ya fue revisado'; end if;
  v_pago := public.registrar_pago(c.alumno_id, c.fecha, c.monto, 'transferencia', coalesce(c.referencia, 'Comprobante en la app'), c.cuota_ids);
  update public.comprobantes_pago set estado = 'aprobado', pago_id = v_pago, revisado_at = now() where id = p_id;
  return v_pago;
end $$;

create or replace function public.rechazar_comprobante(p_id uuid, p_motivo text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if not public.es_entrenador() then raise exception 'Solo el entrenador puede rechazar pagos'; end if;
  update public.comprobantes_pago
     set estado = 'rechazado', motivo = nullif(trim(p_motivo), ''), revisado_at = now()
   where id = p_id and estado = 'pendiente';
  if not found then raise exception 'Este comprobante ya fue revisado'; end if;
end $$;

alter table public.comprobantes_pago enable row level security;

drop policy if exists "entrenador: acceso total" on public.comprobantes_pago;
create policy "entrenador: acceso total" on public.comprobantes_pago
  for all to authenticated
  using ((select public.es_entrenador())) with check ((select public.es_entrenador()));

drop policy if exists "alumno: ve los suyos" on public.comprobantes_pago;
create policy "alumno: ve los suyos" on public.comprobantes_pago
  for select to authenticated using (alumno_id = (select public.mi_alumno_id()));

drop policy if exists "alumno: carga el suyo" on public.comprobantes_pago;
create policy "alumno: carga el suyo" on public.comprobantes_pago
  for insert to authenticated with check (alumno_id = (select public.mi_alumno_id()));

drop policy if exists "alumno: retira el pendiente" on public.comprobantes_pago;
create policy "alumno: retira el pendiente" on public.comprobantes_pago
  for delete to authenticated using (alumno_id = (select public.mi_alumno_id()) and estado = 'pendiente');

grant select, insert, update, delete on public.comprobantes_pago to authenticated;
revoke all on public.comprobantes_pago from anon;
revoke execute on function public.aprobar_comprobante(uuid), public.rechazar_comprobante(uuid, text) from public, anon;
grant execute on function public.aprobar_comprobante(uuid), public.rechazar_comprobante(uuid, text) to authenticated;
revoke execute on function public.comprobante_valido() from public, anon, authenticated;

-- ---------- Seguridad: enlaces y textos ----------
-- "not valid": se aplica a lo que se guarde de ahora en más (no revisa lo viejo).
do $$
declare
  r record;
begin
  for r in select * from (values
    ('competencias', 'competencias_link_https', 'resultado_link is null or resultado_link ~* ''^https://'''),
    ('sesiones_registradas', 'sesiones_garmin_https', 'garmin_url is null or garmin_url ~* ''^https://'''),
    ('sesiones_registradas', 'sesiones_comentario_largo', 'char_length(comentario_alumno) <= 2000'),
    ('evaluaciones', 'evaluaciones_comentario_largo', 'char_length(comentario) <= 2000'),
    ('competencias', 'competencias_textos_largo', 'char_length(nombre) <= 120 and char_length(lugar) <= 120 and char_length(comentario_alumno) <= 1000 and char_length(resultado_comentario) <= 1000'),
    ('mensajes', 'mensajes_texto_largo', 'char_length(texto) <= 2000')
  ) as x(tabla, nombre, regla)
  loop
    if not exists (select 1 from pg_constraint where conname = r.nombre) then
      execute format('alter table public.%I add constraint %I check (%s) not valid', r.tabla, r.nombre, r.regla);
    end if;
  end loop;
end $$;

-- Las solicitudes de alta guardan cuándo se aceptó el aviso de privacidad.
alter table public.solicitudes_alta add column if not exists acepta_privacidad_at timestamptz;


-- >>>>> 20261024000200_storage_comprobantes.sql
-- =====================================================================
-- Rivero Track & Field — 20. Comprobantes de pago (Supabase Storage)
-- Depósito PRIVADO "comprobantes": cada alumno sube en su carpeta (su id)
-- y solo él y el entrenador pueden verlos. Máximo 5 MB, imagen o PDF.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comprobantes: subir el propio" on storage.objects;
create policy "comprobantes: subir el propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "comprobantes: ver el propio o entrenador" on storage.objects;
create policy "comprobantes: ver el propio o entrenador" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.es_entrenador())));

drop policy if exists "comprobantes: borrar el propio" on storage.objects;
create policy "comprobantes: borrar el propio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- >>>>> 20261025000100_ciclo_personalizado.sql
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


-- >>>>> 20261026000100_resultados_carrera.sql
-- =====================================================================
-- Rivero Track & Field — 22. Resultados de carrera y ciclo para el entrenador
--   * Resultado de una competencia con distancia real, posición general
--     y por categoría (y de cuántos corredores), para compartir el logro.
--   * El resumen del ciclo para el entrenador funciona aunque la alumna
--     no haya completado su perfil del ciclo (si comparte, ve fase y día).
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

alter table public.competencias
  add column if not exists resultado_distancia_km  numeric(6,2) check (resultado_distancia_km is null or resultado_distancia_km between 0.1 and 400),
  add column if not exists resultado_pos_general   integer check (resultado_pos_general is null or resultado_pos_general between 1 and 100000),
  add column if not exists resultado_total_general integer check (resultado_total_general is null or resultado_total_general between 1 and 100000),
  add column if not exists resultado_categoria     text check (resultado_categoria is null or char_length(resultado_categoria) <= 40),
  add column if not exists resultado_pos_categoria integer check (resultado_pos_categoria is null or resultado_pos_categoria between 1 and 100000),
  add column if not exists resultado_total_categoria integer check (resultado_total_categoria is null or resultado_total_categoria between 1 and 100000);

-- Cargar el resultado (la alumna/el alumno o el entrenador), una vez corrida la carrera.
create or replace function public.cargar_resultado_carrera(
  p_competencia_id  uuid,
  p_tiempo_seg      integer,
  p_distancia_km    numeric,
  p_pos_general     integer,
  p_total_general   integer,
  p_categoria       text,
  p_pos_categoria   integer,
  p_total_categoria integer,
  p_comentario      text,
  p_link            text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_categoria text := nullif(trim(p_categoria), '');
begin
  if p_tiempo_seg is null or p_tiempo_seg <= 0 or p_tiempo_seg > 172800 then
    raise exception 'Ingresá un tiempo válido';
  end if;
  if (p_pos_general is not null and p_total_general is not null and p_pos_general > p_total_general)
     or (p_pos_categoria is not null and p_total_categoria is not null and p_pos_categoria > p_total_categoria) then
    raise exception 'La posición no puede ser mayor que la cantidad de corredores';
  end if;

  update public.competencias
     set resultado_tiempo_seg      = p_tiempo_seg,
         resultado_distancia_km    = p_distancia_km,
         resultado_pos_general     = p_pos_general,
         resultado_total_general   = p_total_general,
         resultado_categoria       = v_categoria,
         resultado_pos_categoria   = p_pos_categoria,
         resultado_total_categoria = p_total_categoria,
         -- Texto corto que ya usaban otras pantallas ("15° general · 3° F30-34").
         resultado_posicion = nullif(concat_ws(' · ',
           case when p_pos_general is not null then p_pos_general || '° general' end,
           case when p_pos_categoria is not null then p_pos_categoria || '° ' || coalesce(v_categoria, 'categoría') end), ''),
         resultado_comentario = nullif(trim(p_comentario), ''),
         resultado_link       = nullif(trim(p_link), '')
   where id = p_competencia_id
     and estado = 'aprobada'
     and fecha <= public.hoy_py()
     and (alumno_id = public.mi_alumno_id() or public.es_entrenador());
  if not found then
    raise exception 'Solo se puede cargar el resultado de una competencia aprobada que ya se corrió';
  end if;
end $$;

revoke execute on function public.cargar_resultado_carrera(uuid, integer, numeric, integer, integer, text, integer, integer, text, text) from public, anon;
grant execute on function public.cargar_resultado_carrera(uuid, integer, numeric, integer, integer, text, integer, integer, text, text) to authenticated;

-- Resumen del ciclo para el entrenador: si la alumna comparte pero todavía no
-- completó su perfil, igual devuelve "fase y día" (con duraciones aprendidas).
create or replace function public.info_ciclo_alumna(p_alumno_id uuid)
returns table (nivel text, duracion_ciclo smallint, duracion_periodo smallint, hormonal boolean, irregular boolean)
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.compartir, 'fase'), p.duracion_ciclo, p.duracion_periodo,
         coalesce(p.anticonceptivo not in ('ninguno', 'diu_cobre'), false),
         coalesce(p.regular = false, false) or coalesce('sop' = any (p.condiciones), false)
    from public.alumnos a
    left join public.perfil_ciclo p on p.alumno_id = a.id
   where a.id = p_alumno_id
     and public.es_entrenador()
     and public.comparte_ciclo(a.id)
     and not coalesce(p.pausado, false);
$$;

