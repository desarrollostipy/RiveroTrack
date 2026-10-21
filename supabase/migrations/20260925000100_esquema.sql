-- =====================================================================
-- Rivero Track & Field — 01. Esquema base (tablas)
-- Convenciones:
--   * Ritmos en segundos por km (300 = 5:00/km).
--   * Montos en guaraníes, enteros.
--   * "Hoy" siempre en America/Asuncion (función hoy_py()).
-- =====================================================================

-- ---------- Utilidades ----------

create or replace function public.hoy_py()
returns date
language sql stable
as $$ select (now() at time zone 'America/Asuncion')::date $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end $$;


-- =====================================================================
-- PERSONAS
-- =====================================================================

-- Una fila por cuenta de login. La crea la función gestionar-acceso.
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  ci                 text not null unique check (ci ~ '^[0-9]{4,10}$'),
  rol                text not null check (rol in ('entrenador', 'alumno')),
  nombre             text not null,
  email              text,          -- solo de contacto, no se usa para ingresar
  telefono           text,
  debe_cambiar_clave boolean not null default true,
  created_at         timestamptz not null default now()
);

-- Un único entrenador.
create unique index profiles_un_solo_entrenador on public.profiles (rol) where rol = 'entrenador';


-- Valor general de la cuota (una sola fila: id siempre = true).
create table public.config_cuotas (
  id                      boolean primary key default true check (id),
  monto_default           integer  not null check (monto_default >= 0),
  dia_vencimiento_default smallint not null check (dia_vencimiento_default between 1 and 28),
  updated_at              timestamptz not null default now()
);

insert into public.config_cuotas (monto_default, dia_vencimiento_default) values (250000, 10);

create trigger config_cuotas_updated_at before update on public.config_cuotas
  for each row execute function public.set_updated_at();


-- Ficha del alumno. Existe aunque todavía no tenga acceso (profile_id vacío).
-- Las notas privadas del entrenador van en una tabla aparte (notas_privadas)
-- para que el alumno no pueda leerlas nunca, ni siquiera consultando la API.
create table public.alumnos (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid unique references public.profiles (id) on delete set null,
  nombre           text not null,
  fecha_nacimiento date,
  objetivo         text,
  nivel            text not null default 'principiante'
                   check (nivel in ('principiante', 'intermedio', 'avanzado')),
  fc_max           smallint check (fc_max between 100 and 230),
  altura_cm        smallint check (altura_cm between 100 and 230),
  sexo             text not null check (sexo in ('F', 'M')),
  comparte_ciclo   boolean not null default false,
  cuota_mensual    integer  not null check (cuota_mensual >= 0),
  dia_vencimiento  smallint not null check (dia_vencimiento between 1 and 28),
  activo           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Si al crear el alumno no se indica cuota o día, toma el valor general.
create or replace function public.alumnos_cuota_por_defecto()
returns trigger
language plpgsql
as $$
begin
  select coalesce(new.cuota_mensual, c.monto_default),
         coalesce(new.dia_vencimiento, c.dia_vencimiento_default)
    into new.cuota_mensual, new.dia_vencimiento
    from public.config_cuotas c;
  return new;
end $$;

create trigger alumnos_cuota_por_defecto before insert on public.alumnos
  for each row execute function public.alumnos_cuota_por_defecto();


-- Notas privadas del entrenador sobre cada alumno. Solo las ve el entrenador.
create table public.notas_privadas (
  alumno_id  uuid primary key references public.alumnos (id) on delete cascade,
  notas      text not null default '',
  updated_at timestamptz not null default now()
);

create trigger notas_privadas_updated_at before update on public.notas_privadas
  for each row execute function public.set_updated_at();


create table public.marcas_personales (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null references public.alumnos (id) on delete cascade,
  distancia  text not null check (distancia in ('5K', '10K', '21K', '42K', 'otra')),
  tiempo_seg integer not null check (tiempo_seg > 0),
  fecha      date,
  carrera    text
);

create index on public.marcas_personales (alumno_id);


-- Historial de peso.
create table public.mediciones (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.alumnos (id) on delete cascade,
  fecha       date not null default public.hoy_py(),
  peso_kg     numeric(4,1) not null check (peso_kg between 25 and 250),
  cargado_por uuid not null default auth.uid() references public.profiles (id)
);

create index on public.mediciones (alumno_id, fecha desc);


-- Ciclo menstrual: solo alumnas, un registro por período. Dato de salud sensible.
create table public.ciclos_menstruales (
  id           uuid primary key default gen_random_uuid(),
  alumno_id    uuid not null references public.alumnos (id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin    date check (fecha_fin is null or fecha_fin >= fecha_inicio),
  created_at   timestamptz not null default now(),
  unique (alumno_id, fecha_inicio)
);


-- =====================================================================
-- PLANIFICACIÓN
-- =====================================================================

create table public.tipos_sesion (
  codigo text primary key check (codigo ~ '^[a-z_]+$'),
  nombre text not null,
  color  text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  orden  smallint not null default 0
);

insert into public.tipos_sesion (codigo, nombre, color, orden) values
  ('pista',      'Pista',      '#1446B8', 1),
  ('rodaje',     'Rodaje',     '#56617A', 2),
  ('series',     'Series',     '#0B1B3A', 3),
  ('fondo',      'Fondo',      '#0F6E78', 4),
  ('especifico', 'Específico', '#6B4E8C', 5),
  ('descanso',   'Descanso',   '#76819A', 6);


create table public.competencias (
  id                  uuid primary key default gen_random_uuid(),
  alumno_id           uuid not null references public.alumnos (id) on delete cascade,
  nombre              text not null,
  fecha               date not null,
  distancia_km        numeric(5,2) check (distancia_km > 0),
  tiempo_objetivo_seg integer check (tiempo_objetivo_seg > 0),
  prioridad           text not null default 'B' check (prioridad in ('A', 'B', 'C'))
);

create index on public.competencias (alumno_id, fecha);


create table public.planes_semanales (
  id            uuid primary key default gen_random_uuid(),
  alumno_id     uuid not null references public.alumnos (id) on delete cascade,
  semana_inicio date not null check (extract(isodow from semana_inicio) = 1), -- siempre lunes
  estado        text not null default 'borrador' check (estado in ('borrador', 'publicado')),
  nota_semana   text,
  copiado_de    uuid references public.planes_semanales (id) on delete set null,
  publicado_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (alumno_id, semana_inicio)
);

create trigger planes_semanales_updated_at before update on public.planes_semanales
  for each row execute function public.set_updated_at();


-- Hasta 2 sesiones por día (turno 1 = única o mañana, turno 2 = tarde).
create table public.sesiones_planificadas (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.planes_semanales (id) on delete cascade,
  fecha         date not null,
  turno         smallint not null default 1 check (turno in (1, 2)),
  tipo          text not null references public.tipos_sesion (codigo) on update cascade,
  resumen       text,           -- lo que hoy va por WhatsApp: "12 km", "6×1000"
  distancia_km  numeric(5,2) check (distancia_km > 0),
  duracion_min  smallint check (duracion_min > 0),
  ritmo_min_seg smallint check (ritmo_min_seg > 0),  -- el más rápido del rango
  ritmo_max_seg smallint check (ritmo_max_seg > 0),  -- el más lento del rango
  estructura    text,
  notas         text,
  unique (plan_id, fecha, turno),
  check (ritmo_min_seg is null or ritmo_max_seg is null or ritmo_min_seg <= ritmo_max_seg)
);

create index on public.sesiones_planificadas (fecha);

-- La fecha de la sesión tiene que caer dentro de la semana del plan.
create or replace function public.validar_fecha_sesion()
returns trigger
language plpgsql
as $$
declare
  v_inicio date;
begin
  select semana_inicio into v_inicio from public.planes_semanales where id = new.plan_id;
  if new.fecha < v_inicio or new.fecha > v_inicio + 6 then
    raise exception 'La fecha % no pertenece a la semana del plan (lunes %)',
      to_char(new.fecha, 'DD/MM'), to_char(v_inicio, 'DD/MM');
  end if;
  return new;
end $$;

create trigger sesiones_planificadas_fecha before insert or update of fecha, plan_id
  on public.sesiones_planificadas
  for each row execute function public.validar_fecha_sesion();


-- =====================================================================
-- EJECUCIÓN Y FEEDBACK
-- =====================================================================

-- Lo que el alumno hizo. Siempre ligado a una sesión planificada (1 a 1).
create table public.sesiones_registradas (
  id                    uuid primary key default gen_random_uuid(),
  alumno_id             uuid not null references public.alumnos (id) on delete cascade,
  sesion_planificada_id uuid not null unique
                        references public.sesiones_planificadas (id) on delete restrict,
  fecha                 date not null,
  origen                text not null default 'manual' check (origen in ('garmin', 'manual')),
  garmin_url            text,
  distancia_km          numeric(6,2) check (distancia_km > 0),
  duracion_seg          integer check (duracion_seg > 0),
  ritmo_prom_seg        smallint check (ritmo_prom_seg > 0),
  fc_prom               smallint check (fc_prom between 40 and 240),
  fc_max                smallint check (fc_max between 40 and 240),
  splits                jsonb not null default '[]'::jsonb,  -- [{km, tiempo_seg, ritmo_seg, fc}]
  sensacion             smallint check (sensacion between 1 and 5),
  comentario_alumno     text,
  datos_crudos          jsonb,     -- lo leído de Garmin, para auditar
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index on public.sesiones_registradas (alumno_id, fecha desc);

create trigger sesiones_registradas_updated_at before update on public.sesiones_registradas
  for each row execute function public.set_updated_at();

-- alumno_id se toma siempre de la sesión planificada (no se puede falsear).
-- Si la sesión no existe o el alumno no la puede ver (plan en borrador), falla.
create or replace function public.completar_sesion_registrada()
returns trigger
language plpgsql
as $$
declare
  v_alumno uuid;
  v_fecha  date;
begin
  select p.alumno_id, sp.fecha into v_alumno, v_fecha
    from public.sesiones_planificadas sp
    join public.planes_semanales p on p.id = sp.plan_id
   where sp.id = new.sesion_planificada_id;

  if v_alumno is null then
    raise exception 'La sesión planificada no existe o todavía no está publicada';
  end if;

  new.alumno_id := v_alumno;
  new.fecha     := coalesce(new.fecha, v_fecha);
  return new;
end $$;

create trigger sesiones_registradas_completar
  before insert or update of sesion_planificada_id on public.sesiones_registradas
  for each row execute function public.completar_sesion_registrada();


-- Molestias del ciclo al registrar una sesión. Tabla aparte (no una columna
-- de sesiones_registradas) para que el entrenador solo la vea si la alumna
-- comparte su ciclo: así lo controla la base de datos, no la pantalla.
create table public.molestias_ciclo (
  sesion_registrada_id uuid primary key
                       references public.sesiones_registradas (id) on delete cascade,
  alumno_id            uuid not null references public.alumnos (id) on delete cascade,
  nivel                text not null check (nivel in ('ninguna', 'leves', 'fuertes'))
);


-- Criterio del entrenador. Una por sesión planificada (puede comentar
-- también una sesión que no se hizo). La sesión registrada, si existe,
-- se obtiene por sesion_planificada_id (relación 1 a 1).
create table public.evaluaciones (
  id                    uuid primary key default gen_random_uuid(),
  sesion_planificada_id uuid not null unique
                        references public.sesiones_planificadas (id) on delete cascade,
  resultado             text not null check (resultado in ('cumplio', 'parcial', 'no_cumplio')),
  comentario            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  leida_at              timestamptz
);

create trigger evaluaciones_updated_at before update on public.evaluaciones
  for each row execute function public.set_updated_at();


-- =====================================================================
-- CUENTAS
-- =====================================================================
-- Pagos y cuotas usan "on delete restrict": un alumno con historial de
-- cobros no se borra, se marca como inactivo (activo = false).

create table public.pagos (
  id             uuid primary key default gen_random_uuid(),
  alumno_id      uuid not null references public.alumnos (id) on delete restrict,
  fecha          date not null default public.hoy_py(),
  monto          integer not null check (monto > 0),
  medio          text not null check (medio in ('transferencia', 'efectivo')),
  referencia     text,
  registrado_por uuid not null default auth.uid() references public.profiles (id),
  created_at     timestamptz not null default now()
);

create index on public.pagos (alumno_id, fecha desc);


-- Una cuota por alumno por mes. "Vencida" no se guarda:
-- es estado = 'pendiente' con vencimiento anterior a hoy.
create table public.cuotas (
  id          uuid primary key default gen_random_uuid(),
  alumno_id   uuid not null references public.alumnos (id) on delete restrict,
  periodo     date not null check (extract(day from periodo) = 1),  -- primer día del mes
  monto       integer not null check (monto >= 0),                 -- copia de la cuota vigente
  vencimiento date not null,
  estado      text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  pago_id     uuid references public.pagos (id) on delete set null,
  unique (alumno_id, periodo)
);

create index on public.cuotas (estado, vencimiento);
create index on public.cuotas (pago_id);

-- El estado se deriva del pago: con pago = pagada, sin pago = pendiente.
-- (Si se borra un pago, sus cuotas vuelven solas a pendiente.)
create or replace function public.cuotas_estado_desde_pago()
returns trigger
language plpgsql
as $$
begin
  new.estado := case when new.pago_id is null then 'pendiente' else 'pagada' end;
  return new;
end $$;

create trigger cuotas_estado before insert or update on public.cuotas
  for each row execute function public.cuotas_estado_desde_pago();
