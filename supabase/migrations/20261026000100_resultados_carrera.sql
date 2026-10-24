-- =====================================================================
-- Rivero Track & Field — 22. Resultados de carrera y ciclo para el entrenador
--   * Resultado de una competencia con distancia real, posición general
--     y por categoría (y de cuántos corredores), para compartir el logro.
--   * El resumen del ciclo para el entrenador funciona aunque la alumna
--     no haya completado su perfil del ciclo (si comparte, ve fase y día).
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

alter table public.competencias
  add column if not exists resultado_distancia_km  numeric(6,2) check (resultado_distancia_km is null or resultado_distancia_km between 0.1 and 400),
  add column if not exists resultado_pos_general   integer check (resultado_pos_general is null or resultado_pos_general between 1 and 100000),
  add column if not exists resultado_total_general integer check (resultado_total_general is null or resultado_total_general between 1 and 100000),
  add column if not exists resultado_categoria     text check (resultado_categoria is null or char_length(resultado_categoria) <= 40),
  add column if not exists resultado_pos_categoria integer check (resultado_pos_categoria is null or resultado_pos_categoria between 1 and 100000),
  add column if not exists resultado_total_categoria integer check (resultado_total_categoria is null or resultado_total_categoria between 1 and 100000);

-- Cargar el resultado (la alumna/el alumno o el entrenador), una vez corrida la carrera.
create or replace function public.cargar_resultado_carrera(
  p_competencia_id  uuid,
  p_tiempo_seg      integer,
  p_distancia_km    numeric,
  p_pos_general     integer,
  p_total_general   integer,
  p_categoria       text,
  p_pos_categoria   integer,
  p_total_categoria integer,
  p_comentario      text,
  p_link            text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_categoria text := nullif(trim(p_categoria), '');
begin
  if p_tiempo_seg is null or p_tiempo_seg <= 0 or p_tiempo_seg > 172800 then
    raise exception 'Ingresá un tiempo válido';
  end if;
  if (p_pos_general is not null and p_total_general is not null and p_pos_general > p_total_general)
     or (p_pos_categoria is not null and p_total_categoria is not null and p_pos_categoria > p_total_categoria) then
    raise exception 'La posición no puede ser mayor que la cantidad de corredores';
  end if;

  update public.competencias
     set resultado_tiempo_seg      = p_tiempo_seg,
         resultado_distancia_km    = p_distancia_km,
         resultado_pos_general     = p_pos_general,
         resultado_total_general   = p_total_general,
         resultado_categoria       = v_categoria,
         resultado_pos_categoria   = p_pos_categoria,
         resultado_total_categoria = p_total_categoria,
         -- Texto corto que ya usaban otras pantallas ("15° general · 3° F30-34").
         resultado_posicion = nullif(concat_ws(' · ',
           case when p_pos_general is not null then p_pos_general || '° general' end,
           case when p_pos_categoria is not null then p_pos_categoria || '° ' || coalesce(v_categoria, 'categoría') end), ''),
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

revoke execute on function public.cargar_resultado_carrera(uuid, integer, numeric, integer, integer, text, integer, integer, text, text) from public, anon;
grant execute on function public.cargar_resultado_carrera(uuid, integer, numeric, integer, integer, text, integer, integer, text, text) to authenticated;

-- Resumen del ciclo para el entrenador: si la alumna comparte pero todavía no
-- completó su perfil, igual devuelve "fase y día" (con duraciones aprendidas).
create or replace function public.info_ciclo_alumna(p_alumno_id uuid)
returns table (nivel text, duracion_ciclo smallint, duracion_periodo smallint, hormonal boolean, irregular boolean)
language sql stable security definer set search_path = ''
as $$
  select coalesce(p.compartir, 'fase'), p.duracion_ciclo, p.duracion_periodo,
         coalesce(p.anticonceptivo not in ('ninguno', 'diu_cobre'), false),
         coalesce(p.regular = false, false) or coalesce('sop' = any (p.condiciones), false)
    from public.alumnos a
    left join public.perfil_ciclo p on p.alumno_id = a.id
   where a.id = p_alumno_id
     and public.es_entrenador()
     and public.comparte_ciclo(a.id)
     and not coalesce(p.pausado, false);
$$;
