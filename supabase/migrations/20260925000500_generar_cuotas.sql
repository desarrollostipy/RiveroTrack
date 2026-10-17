-- =====================================================================
-- Rivero Track & Field — 05. Generación mensual de cuotas
-- Crea la cuota del mes para cada alumno activo que todavía no la tenga,
-- con su cuota_mensual y su dia_vencimiento vigentes. Las cuotas ya
-- generadas no cambian. Se puede llamar las veces que sea: no duplica.
-- La llama pg_cron el día 1 (migración 06) y, como respaldo, la app al
-- abrir la pantalla Cuentas.
-- =====================================================================

create or replace function public.generar_cuotas(
  p_periodo date default public.hoy_py()
)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_mes   date := date_trunc('month', p_periodo)::date;
  v_total integer;
begin
  -- auth.uid() es null cuando la llama pg_cron (servidor); si la llama
  -- un usuario, tiene que ser el entrenador.
  if auth.uid() is not null and not public.es_entrenador() then
    raise exception 'Solo el entrenador puede generar cuotas';
  end if;

  insert into public.cuotas (alumno_id, periodo, monto, vencimiento)
  select a.id, v_mes, a.cuota_mensual, v_mes + (a.dia_vencimiento - 1)
    from public.alumnos a
   where a.activo
  on conflict (alumno_id, periodo) do nothing;

  get diagnostics v_total = row_count;
  return v_total;
end $$;

revoke execute on function public.generar_cuotas(date) from public, anon;
grant  execute on function public.generar_cuotas(date) to authenticated;


-- Alta a mitad de mes: el alumno paga el mes en curso. Al crearlo activo
-- se genera su cuota del mes con el vencimiento normal. Si no corresponde,
-- el entrenador la puede borrar desde Cuentas.
create or replace function public.cuota_al_dar_de_alta()
returns trigger
language plpgsql
as $$
declare
  v_mes date := date_trunc('month', public.hoy_py())::date;
begin
  if new.activo then
    insert into public.cuotas (alumno_id, periodo, monto, vencimiento)
    values (new.id, v_mes, new.cuota_mensual, v_mes + (new.dia_vencimiento - 1))
    on conflict (alumno_id, periodo) do nothing;
  end if;
  return null;
end $$;

create trigger alumnos_cuota_al_alta after insert on public.alumnos
  for each row execute function public.cuota_al_dar_de_alta();
