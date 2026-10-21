-- =====================================================================
-- Rivero Track & Field — 06. Tarea programada (pg_cron)
-- pg_cron corre en hora UTC. Paraguay es UTC-3 todo el año, así que
-- 03:05 UTC = 00:05 del día 1 en Asunción.
-- Si pg_cron no estuviera disponible, esta migración se puede quitar:
-- la app genera las cuotas faltantes al abrir Cuentas.
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'generar-cuotas-mensuales',
  '5 3 1 * *',
  $$ select public.generar_cuotas(); $$
);
