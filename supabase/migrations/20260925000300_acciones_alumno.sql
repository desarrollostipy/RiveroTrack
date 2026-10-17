-- =====================================================================
-- Rivero Track & Field — 03. Acciones puntuales del alumno
-- El alumno no tiene permiso de UPDATE sobre profiles, alumnos ni
-- evaluaciones (si lo tuviera, podría cambiarse el rol o la cuota).
-- Estas funciones le permiten tocar exactamente un campo, y nada más.
-- =====================================================================

-- Después de cambiar la clave en el primer ingreso.
create or replace function public.marcar_clave_cambiada()
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set debe_cambiar_clave = false where id = auth.uid();
$$;

-- Interruptor "Compartir con mi entrenador" (solo alumnas).
create or replace function public.set_comparte_ciclo(p_comparte boolean)
returns void
language sql security definer set search_path = ''
as $$
  update public.alumnos
     set comparte_ciclo = p_comparte
   where profile_id = auth.uid() and sexo = 'F';
$$;

-- El alumno carga su altura.
create or replace function public.set_mi_altura(p_altura_cm smallint)
returns void
language sql security definer set search_path = ''
as $$
  update public.alumnos set altura_cm = p_altura_cm where profile_id = auth.uid();
$$;

-- El alumno marca como leída una evaluación suya (de un plan publicado).
create or replace function public.marcar_evaluacion_leida(p_evaluacion_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.evaluaciones e
     set leida_at = now()
    from public.sesiones_planificadas sp
    join public.planes_semanales p on p.id = sp.plan_id
    join public.alumnos a          on a.id = p.alumno_id
   where e.id = p_evaluacion_id
     and e.leida_at is null
     and sp.id = e.sesion_planificada_id
     and p.estado = 'publicado'
     and a.profile_id = auth.uid();
$$;

-- Pantalla de ingreso: ¿mostrar "Primer uso: crear el acceso del entrenador"?
-- Única función que se puede llamar sin sesión. Solo responde sí o no.
create or replace function public.hay_entrenador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where rol = 'entrenador');
$$;

grant execute on function public.hay_entrenador() to anon, authenticated;

revoke execute on function
  public.marcar_clave_cambiada(),
  public.set_comparte_ciclo(boolean),
  public.set_mi_altura(smallint),
  public.marcar_evaluacion_leida(uuid)
from public, anon;

grant execute on function
  public.marcar_clave_cambiada(),
  public.set_comparte_ciclo(boolean),
  public.set_mi_altura(smallint),
  public.marcar_evaluacion_leida(uuid)
to authenticated;
