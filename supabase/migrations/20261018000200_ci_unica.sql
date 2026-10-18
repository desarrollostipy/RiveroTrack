-- =====================================================================
-- Rivero Track & Field — 09. Una CI = un alumno
-- La ficha guarda la CI aunque el alumno todavía no tenga acceso, y no
-- puede haber dos fichas con la misma CI. Si alguien se registra con la
-- CI de una ficha ya cargada, al aceptarlo se vincula a esa ficha.
-- =====================================================================

alter table public.alumnos add column ci text check (ci ~ '^[0-9]{4,10}$');

-- Completar con la CI de los que ya tienen acceso.
update public.alumnos a set ci = p.ci from public.profiles p where p.id = a.profile_id and a.ci is null;

create unique index alumnos_ci_unica on public.alumnos (ci) where ci is not null;


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
