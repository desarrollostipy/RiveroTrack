-- =====================================================================
-- Rivero Track & Field — 10. Pulso objetivo por sesión
-- Ejemplo: rodaje a 130 ppm (un valor) o de 125 a 135 ppm (rango).
-- Si se carga un solo valor, va en fc_obj_max ("hasta 130 ppm").
-- =====================================================================

alter table public.sesiones_planificadas
  add column fc_obj_min smallint check (fc_obj_min between 60 and 230),
  add column fc_obj_max smallint check (fc_obj_max between 60 and 230),
  add constraint sesiones_planificadas_fc_rango check (fc_obj_min is null or fc_obj_max is null or fc_obj_min <= fc_obj_max);
