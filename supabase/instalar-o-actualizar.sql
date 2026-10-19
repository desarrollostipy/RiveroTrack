-- =====================================================================
-- RIVERO TRACK & FIELD — INSTALADOR / ACTUALIZADOR DE LA BASE DE DATOS
--
-- Pegar ENTERO en Supabase → SQL Editor → Run.
-- Se puede correr las veces que haga falta: lo que ya existe no se toca
-- y lo que falta se crea. Incluye todo lo agregado después de la
-- instalación inicial (pagos, registro de alumnos, CI única, pulso,
-- competencias, velocidad, perfil y chat, fotos, herramientas, avisos).
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


