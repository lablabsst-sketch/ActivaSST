-- El índice único (programacion_id, trabajador_id) impedía que un trabajador
-- completara una programación RECURRENTE más de una vez (una por día/slot).
-- Resultado: el 2º "Completar" fallaba con 23505 (duplicate key) y el ciclo se
-- rompía (adherencia tope de 1 completada por programación).
--
-- La idempotencia de reintentos (cola offline) ya está garantizada por el
-- índice único sobre response_uuid, así que este índice es incorrecto y
-- redundante. Se elimina.
DROP INDEX IF EXISTS public.uq_pausa_registros_prog_trab;

COMMENT ON TABLE public.pausa_registros IS
  'Registro auditable, append-only. Admite múltiples respuestas por (programación, trabajador): una por cada slot recurrente. La idempotencia de reintentos se garantiza vía response_uuid (uq_pausa_registros_response).';
