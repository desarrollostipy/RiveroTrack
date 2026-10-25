-- =====================================================================
-- Rivero Track & Field — 23. Calorías
--   Las calorías que muestra el reloj (opcional) en cada sesión y en cada
--   actividad extra. Si no se cargan, la app las estima con el peso, la
--   distancia, el tiempo y el pulso. Es una referencia, no un dato médico.
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

alter table public.sesiones_registradas
  add column if not exists calorias integer check (calorias is null or calorias between 1 and 10000);

alter table public.actividades_extra
  add column if not exists calorias integer check (calorias is null or calorias between 1 and 10000);
