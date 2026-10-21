-- =====================================================================
-- Rivero Track & Field — 16. Salud y seguimiento (Etapa 1)
--   * Diario de bienestar (sueño, energía, dolor y ánimo)
--   * Molestias con zona del cuerpo
--   * Zapatillas y sus kilómetros
--   * Metas personales
--   * Ficha médica y contacto de emergencia
--   * Pulso máximo y de reposo que puede cargar el propio alumno
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

-- ---------- Pulso del alumno ----------
alter table public.alumnos add column if not exists fc_reposo smallint check (fc_reposo between 30 and 120);

-- El alumno puede cargar su pulso máximo y de reposo (por ejemplo, de su reloj).
create or replace function public.set_mi_pulso(p_fc_max smallint, p_fc_reposo smallint)
returns void
language sql security definer set search_path = ''
as $$
  update public.alumnos
     set fc_max = p_fc_max, fc_reposo = p_fc_reposo
   where profile_id = auth.uid();
$$;

-- ---------- Diario de bienestar (uno por día) ----------
create table if not exists public.bienestar_diario (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  fecha      date not null default public.hoy_py(),
  sueno      smallint not null check (sueno between 1 and 5),   -- 1 muy mal … 5 excelente
  energia    smallint not null check (energia between 1 and 5),
  dolor      smallint not null check (dolor between 1 and 5),   -- 1 nada … 5 mucho
  animo      smallint not null check (animo between 1 and 5),
  nota       text check (char_length(nota) <= 300),
  created_at timestamptz not null default now(),
  unique (alumno_id, fecha)
);
create index if not exists bienestar_fecha on public.bienestar_diario (fecha desc);

-- ---------- Molestias ----------
create table if not exists public.molestias (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  fecha       date not null default public.hoy_py(),
  zona        text not null check (zona in (
                'cuello', 'hombro', 'espalda_alta', 'lumbar', 'cadera', 'gluteo', 'ingle',
                'cuadriceps', 'isquiotibiales', 'rodilla', 'tibia', 'gemelo', 'aquiles',
                'tobillo', 'pie', 'otra')),
  lado        text check (lado in ('izq', 'der', 'ambos')),
  intensidad  smallint not null check (intensidad between 1 and 10),
  nota        text check (char_length(nota) <= 300),
  resuelta_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists molestias_alumno on public.molestias (alumno_id, fecha desc);

-- ---------- Zapatillas ----------
create table if not exists public.calzado (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  nombre     text not null check (char_length(trim(nombre)) between 1 and 60),
  km_inicial numeric(6,1) not null default 0 check (km_inicial >= 0),
  limite_km  smallint not null default 700 check (limite_km between 100 and 2000),
  principal  boolean not null default false,
  retirada   boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists calzado_alumno on public.calzado (alumno_id);

alter table public.sesiones_registradas
  add column if not exists calzado_id uuid references public.calzado (id) on delete set null;

-- Kilómetros de cada par: los iniciales más las sesiones registradas con él.
create or replace view public.v_calzado_km
with (security_invoker = true) as
select c.*,
       c.km_inicial + coalesce((select sum(s.distancia_km) from public.sesiones_registradas s where s.calzado_id = c.id), 0) as km_total
  from public.calzado c;

-- ---------- Metas personales ----------
create table if not exists public.metas_personales (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid not null default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  titulo         text not null check (char_length(trim(titulo)) between 1 and 80),
  tipo           text not null check (tipo in ('tiempo', 'km', 'libre')),
  distancia      text check (distancia in ('5K', '10K', '21K', '42K')), -- para tipo 'tiempo'
  objetivo_seg   integer check (objetivo_seg > 0),                     -- para tipo 'tiempo'
  objetivo_km    numeric(7,1) check (objetivo_km > 0),                 -- para tipo 'km'
  desde          date not null default public.hoy_py(),
  fecha_limite   date,
  cumplida_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists metas_alumno on public.metas_personales (alumno_id);

-- ---------- Ficha médica y contacto de emergencia ----------
create table if not exists public.fichas_medicas (
  alumno_id         uuid primary key default public.mi_alumno_id() references public.alumnos (id) on delete cascade,
  grupo_sanguineo   text check (grupo_sanguineo in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  alergias          text check (char_length(alergias) <= 300),
  condiciones       text check (char_length(condiciones) <= 300),
  medicacion        text check (char_length(medicacion) <= 300),
  seguro_medico     text check (char_length(seguro_medico) <= 100),
  contacto_nombre   text check (char_length(contacto_nombre) <= 80),
  contacto_relacion text check (char_length(contacto_relacion) <= 40),
  contacto_telefono text check (char_length(contacto_telefono) <= 30),
  updated_at        timestamptz not null default now()
);

-- ---------- Reglas de acceso ----------
-- El alumno gestiona lo suyo; el entrenador ve y gestiona todo.
alter table public.bienestar_diario enable row level security;
alter table public.molestias enable row level security;
alter table public.calzado enable row level security;
alter table public.metas_personales enable row level security;
alter table public.fichas_medicas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bienestar_diario', 'molestias', 'calzado', 'metas_personales', 'fichas_medicas'] loop
    execute format('drop policy if exists "entrenador: acceso total" on public.%I', t);
    execute format(
      'create policy "entrenador: acceso total" on public.%I for all to authenticated
         using ((select public.es_entrenador())) with check ((select public.es_entrenador()))', t);
    execute format('drop policy if exists "alumno: gestiona lo suyo" on public.%I', t);
    execute format(
      'create policy "alumno: gestiona lo suyo" on public.%I for all to authenticated
         using (alumno_id = (select public.mi_alumno_id()))
         with check (alumno_id = (select public.mi_alumno_id()))', t);
  end loop;
end $$;

grant select, insert, update, delete on
  public.bienestar_diario, public.molestias, public.calzado, public.metas_personales, public.fichas_medicas
to authenticated;
grant select on public.v_calzado_km to authenticated;
revoke all on
  public.bienestar_diario, public.molestias, public.calzado, public.metas_personales, public.fichas_medicas,
  public.v_calzado_km
from anon;
revoke execute on function public.set_mi_pulso(smallint, smallint) from public, anon;
grant execute on function public.set_mi_pulso(smallint, smallint) to authenticated;
