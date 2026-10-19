-- =====================================================================
-- Rivero Track & Field — 13. Mi perfil (foto + estado) y chat
-- =====================================================================

-- ---------- Perfil: foto y "estado" (como las notas de Instagram) ----------
alter table public.profiles
  add column avatar_url     text,
  add column estado_emoji   text check (char_length(estado_emoji) <= 16),
  add column estado_texto   text check (char_length(estado_texto) <= 80),
  add column estado_cancion text check (char_length(estado_cancion) <= 80),
  add column estado_at      timestamptz;

-- Cada uno cambia SOLO su foto y su estado (no puede tocar su rol ni su CI).
create or replace function public.set_mi_avatar(p_url text)
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles set avatar_url = nullif(trim(p_url), '') where id = auth.uid();
$$;

create or replace function public.set_mi_estado(p_emoji text, p_texto text, p_cancion text)
returns void
language sql security definer set search_path = ''
as $$
  update public.profiles
     set estado_emoji   = nullif(trim(p_emoji), ''),
         estado_texto   = nullif(trim(p_texto), ''),
         estado_cancion = nullif(trim(p_cancion), ''),
         estado_at      = case when coalesce(trim(p_emoji), trim(p_texto), trim(p_cancion), '') = '' then null else now() end
   where id = auth.uid();
$$;

-- El alumno ve el nombre y la foto de su entrenador (para el chat).
create or replace function public.perfil_entrenador()
returns table (id uuid, nombre text, avatar_url text)
language sql stable security definer set search_path = ''
as $$
  select id, nombre, avatar_url from public.profiles where rol = 'entrenador' limit 1;
$$;


-- ---------- Chat: una conversación por alumno con el entrenador ----------
create table public.mensajes (
  id         uuid primary key default gen_random_uuid(),
  alumno_id  uuid not null references public.alumnos (id) on delete cascade,
  autor_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  texto      text not null check (char_length(trim(texto)) between 1 and 2000),
  created_at timestamptz not null default now(),
  leido_at   timestamptz
);

create index on public.mensajes (alumno_id, created_at desc);
create index on public.mensajes (leido_at) where leido_at is null;

-- El autor es siempre quien envía (no se puede firmar como otro).
create or replace function public.mensajes_autor()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.autor_id := auth.uid();
  end if;
  new.leido_at := null;
  return new;
end $$;

create trigger mensajes_autor before insert on public.mensajes
  for each row execute function public.mensajes_autor();

alter table public.mensajes enable row level security;

create policy "entrenador: todos los chats" on public.mensajes
  for all to authenticated
  using ((select public.es_entrenador()))
  with check ((select public.es_entrenador()));

create policy "alumno: lee su chat" on public.mensajes
  for select to authenticated
  using (alumno_id = (select public.mi_alumno_id()));

create policy "alumno: escribe en su chat" on public.mensajes
  for insert to authenticated
  with check (alumno_id = (select public.mi_alumno_id()) and autor_id = (select auth.uid()));

grant select, insert, update, delete on public.mensajes to authenticated;
revoke all on public.mensajes from anon;

-- Marcar como leídos los mensajes del otro.
create or replace function public.marcar_chat_leido(p_alumno_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.mensajes
     set leido_at = now()
   where alumno_id = p_alumno_id
     and autor_id <> auth.uid()
     and leido_at is null
     and (public.es_entrenador() or p_alumno_id = public.mi_alumno_id());
$$;

revoke execute on function
  public.set_mi_avatar(text), public.set_mi_estado(text, text, text),
  public.perfil_entrenador(), public.marcar_chat_leido(uuid)
from public, anon;
grant execute on function
  public.set_mi_avatar(text), public.set_mi_estado(text, text, text),
  public.perfil_entrenador(), public.marcar_chat_leido(uuid)
to authenticated;

-- Mensajes nuevos sin recargar.
alter publication supabase_realtime add table public.mensajes;
