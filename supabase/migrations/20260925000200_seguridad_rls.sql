-- =====================================================================
-- Rivero Track & Field — 02. Seguridad (Row Level Security)
-- Regla general:
--   * Entrenador: lee y escribe todo (salvo datos del ciclo: solo lee,
--     y solo si la alumna comparte).
--   * Alumno: solo sus propias filas, y solo lectura salvo lo indicado.
-- =====================================================================

-- ---------- Funciones auxiliares ----------
-- "security definer" = corren con permisos del dueño, para poder consultar
-- profiles/alumnos sin quedar atrapadas en las mismas reglas RLS.

create or replace function public.es_entrenador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'entrenador'
  );
$$;

create or replace function public.mi_alumno_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.alumnos where profile_id = auth.uid();
$$;

create or replace function public.comparte_ciclo(p_alumno_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select comparte_ciclo from public.alumnos where id = p_alumno_id and sexo = 'F'),
    false
  );
$$;


-- ---------- Activar RLS + acceso total del entrenador ----------
-- Tablas donde el entrenador lee y escribe todo.
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'alumnos', 'notas_privadas', 'config_cuotas',
    'marcas_personales', 'mediciones', 'tipos_sesion', 'competencias',
    'planes_semanales', 'sesiones_planificadas', 'sesiones_registradas',
    'evaluaciones', 'pagos', 'cuotas'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "entrenador: acceso total" on public.%I for all to authenticated
         using ((select public.es_entrenador()))
         with check ((select public.es_entrenador()))', t);
  end loop;
end $$;

-- Datos del ciclo: RLS activo, pero el entrenador NO tiene acceso total.
alter table public.ciclos_menstruales enable row level security;
alter table public.molestias_ciclo    enable row level security;


-- ---------- Alumno: lectura de lo propio ----------

create policy "alumno: ve su perfil" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "alumno: ve su ficha" on public.alumnos
  for select to authenticated
  using (profile_id = (select auth.uid()));

-- notas_privadas y config_cuotas: sin política para alumnos = no ven nada.

-- Tablas con alumno_id donde el alumno solo lee lo suyo.
do $$
declare
  t text;
begin
  foreach t in array array['marcas_personales', 'competencias', 'cuotas', 'pagos'] loop
    execute format(
      'create policy "alumno: ve lo suyo" on public.%I for select to authenticated
         using (alumno_id = (select public.mi_alumno_id()))', t);
  end loop;
end $$;

create policy "todos: ven los tipos de sesión" on public.tipos_sesion
  for select to authenticated
  using (true);


-- ---------- Planes: el alumno solo ve lo publicado ----------

create policy "alumno: ve sus planes publicados" on public.planes_semanales
  for select to authenticated
  using (alumno_id = (select public.mi_alumno_id()) and estado = 'publicado');

-- La subconsulta a planes_semanales ya aplica la regla de arriba.
create policy "alumno: ve sesiones de planes publicados" on public.sesiones_planificadas
  for select to authenticated
  using (exists (select 1 from public.planes_semanales p where p.id = plan_id));

-- Ve las evaluaciones de sesiones que puede ver. No puede crearlas ni editarlas.
create policy "alumno: ve sus evaluaciones" on public.evaluaciones
  for select to authenticated
  using (exists (select 1 from public.sesiones_planificadas sp where sp.id = sesion_planificada_id));


-- ---------- Sesiones registradas: el alumno crea y edita las suyas ----------

create policy "alumno: gestiona sus sesiones" on public.sesiones_registradas
  for all to authenticated
  using (alumno_id = (select public.mi_alumno_id()))
  with check (alumno_id = (select public.mi_alumno_id()));


-- ---------- Peso: el alumno ve y carga el suyo ----------

create policy "alumno: ve su peso" on public.mediciones
  for select to authenticated
  using (alumno_id = (select public.mi_alumno_id()));

create policy "alumno: carga su peso" on public.mediciones
  for insert to authenticated
  with check (alumno_id = (select public.mi_alumno_id()) and cargado_por = (select auth.uid()));

create policy "alumno: corrige su peso" on public.mediciones
  for update to authenticated
  using (alumno_id = (select public.mi_alumno_id()) and cargado_por = (select auth.uid()))
  with check (alumno_id = (select public.mi_alumno_id()) and cargado_por = (select auth.uid()));

create policy "alumno: borra su peso" on public.mediciones
  for delete to authenticated
  using (alumno_id = (select public.mi_alumno_id()) and cargado_por = (select auth.uid()));


-- ---------- Ciclo menstrual (dato de salud sensible) ----------
-- La alumna carga, corrige y borra lo suyo.
-- El entrenador solo LEE, y solo si comparte_ciclo = true.

create policy "alumna: gestiona su ciclo" on public.ciclos_menstruales
  for all to authenticated
  using (alumno_id = (select public.mi_alumno_id()))
  with check (
    alumno_id = (select public.mi_alumno_id())
    and exists (select 1 from public.alumnos a where a.id = alumno_id and a.sexo = 'F')
  );

create policy "entrenador: ve ciclo compartido" on public.ciclos_menstruales
  for select to authenticated
  using ((select public.es_entrenador()) and public.comparte_ciclo(alumno_id));

create policy "alumna: gestiona sus molestias" on public.molestias_ciclo
  for all to authenticated
  using (alumno_id = (select public.mi_alumno_id()))
  with check (
    alumno_id = (select public.mi_alumno_id())
    and exists (select 1 from public.alumnos a where a.id = alumno_id and a.sexo = 'F')
    and exists (
      select 1 from public.sesiones_registradas s
       where s.id = sesion_registrada_id and s.alumno_id = molestias_ciclo.alumno_id
    )
  );

create policy "entrenador: ve molestias compartidas" on public.molestias_ciclo
  for select to authenticated
  using ((select public.es_entrenador()) and public.comparte_ciclo(alumno_id));


-- ---------- Permisos base ----------
-- Con sesión iniciada se puede operar sobre las tablas, pero siempre
-- filtrado por las reglas RLS de arriba.
-- Sin sesión iniciada (rol "anon") no se puede leer ni escribir nada.
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;


-- ---------- Realtime ----------
-- El entrenador ve sesiones nuevas sin recargar; el alumno, evaluaciones nuevas.
-- Realtime respeta las mismas reglas RLS.
alter publication supabase_realtime add table public.sesiones_registradas, public.evaluaciones;
