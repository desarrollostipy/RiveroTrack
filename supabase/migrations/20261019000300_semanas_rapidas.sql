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
