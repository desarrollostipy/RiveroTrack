-- =====================================================================
-- Rivero Track & Field — 14. Fotos de perfil (Supabase Storage)
-- Carpeta "avatares": cada usuario sube su foto dentro de una carpeta con
-- su propio id. Las fotos se ven por link (nombre de archivo aleatorio).
-- Máximo 2 MB; la app las achica antes de subirlas.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatares: subir la propia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: cambiar la propia" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatares: borrar la propia" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
