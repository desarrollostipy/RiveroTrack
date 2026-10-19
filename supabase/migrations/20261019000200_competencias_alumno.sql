-- =====================================================================
-- Rivero Track & Field — 11. Competencias propuestas por el alumno
-- El alumno propone una carrera; el entrenador la aprueba o no (con un
-- comentario). Después de correrla se carga el resultado y queda como
-- historial para los dos. Las que carga el entrenador nacen aprobadas.
-- =====================================================================

alter table public.competencias
  add column estado                text not null default 'aprobada' check (estado in ('propuesta', 'aprobada', 'rechazada')),
  add column propuesta_por         text not null default 'entrenador' check (propuesta_por in ('alumno', 'entrenador')),
  add column lugar                 text,
  add column comentario_alumno     text,
  add column comentario_entrenador text,
  add column respondida_at         timestamptz,
  add column resultado_tiempo_seg  integer check (resultado_tiempo_seg > 0),
  add column resultado_posicion    text,
  add column resultado_comentario  text,
  add column resultado_link        text,
  add column created_at            timestamptz not null default now();

create index on public.competencias (estado);

-- El alumno puede retirar una propuesta que todavía no se respondió.
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
