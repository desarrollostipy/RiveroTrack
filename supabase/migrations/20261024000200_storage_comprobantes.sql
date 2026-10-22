-- =====================================================================
-- Rivero Track & Field — 20. Comprobantes de pago (Supabase Storage)
-- Depósito PRIVADO "comprobantes": cada alumno sube en su carpeta (su id)
-- y solo él y el entrenador pueden verlos. Máximo 5 MB, imagen o PDF.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "comprobantes: subir el propio" on storage.objects;
create policy "comprobantes: subir el propio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "comprobantes: ver el propio o entrenador" on storage.objects;
create policy "comprobantes: ver el propio o entrenador" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprobantes' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.es_entrenador())));

drop policy if exists "comprobantes: borrar el propio" on storage.objects;
create policy "comprobantes: borrar el propio" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = (select auth.uid())::text);
