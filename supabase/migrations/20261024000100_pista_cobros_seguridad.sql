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
