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
