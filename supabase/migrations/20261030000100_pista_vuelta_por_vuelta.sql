-- =====================================================================
-- Rivero Track & Field — 26. Pista vuelta por vuelta
--   El alumno arma la sesión de pista al registrarla (6×800, 4×400…),
--   con el tiempo de cada vuelta de 400 m y la recuperación de cada
--   repetición. Se guarda como lista de bloques:
--   [{"distancia_m": 800, "reps": [{"vueltas": [88, 90], "rec_seg": 90}, …]}, …]
-- Escrito para poder correrse más de una vez sin error.
-- =====================================================================

alter table public.sesiones_registradas
  add column if not exists pista_bloques jsonb
    check (pista_bloques is null or (jsonb_typeof(pista_bloques) = 'array' and octet_length(pista_bloques::text) <= 20000));
