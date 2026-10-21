-- =====================================================================
-- Rivero Track & Field — 08. Registro de alumnos nuevos
-- El alumno se registra solo desde la pantalla de ingreso (con su CI y
-- un PIN que elige). Queda como solicitud pendiente: puede iniciar
-- sesión, pero no ve nada hasta que el entrenador la acepta y le carga
-- los datos de la cuota.
-- La solicitud la crea la función de Netlify gestionar-acceso.
-- =====================================================================

create table public.solicitudes_alta (
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
create unique index solicitudes_alta_ci_pendiente on public.solicitudes_alta (ci) where estado = 'pendiente';

alter table public.solicitudes_alta enable row level security;

create policy "entrenador: acceso total" on public.solicitudes_alta
  for all to authenticated
  using ((select public.es_entrenador()))
  with check ((select public.es_entrenador()));

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
