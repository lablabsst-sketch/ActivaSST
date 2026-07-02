
-- Habilita extensiones para tareas programadas
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Tabla append-only de bitácora de reconciliación
CREATE TABLE IF NOT EXISTS public.usuarios_reconciliacion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT now(),
  origen TEXT NOT NULL DEFAULT 'cron',
  total_revisados INT NOT NULL DEFAULT 0,
  huerfanas_detectadas INT NOT NULL DEFAULT 0,
  huerfanas_reseteadas INT NOT NULL DEFAULT 0,
  auth_sin_perfil INT NOT NULL DEFAULT 0,
  ids_reseteados UUID[] NOT NULL DEFAULT '{}',
  ids_auth_sin_perfil UUID[] NOT NULL DEFAULT '{}',
  detalle JSONB
);

GRANT SELECT ON public.usuarios_reconciliacion_log TO authenticated;
GRANT ALL ON public.usuarios_reconciliacion_log TO service_role;

ALTER TABLE public.usuarios_reconciliacion_log ENABLE ROW LEVEL SECURITY;

-- Solo empresa_admin puede leer la bitácora
CREATE POLICY "recon_log_read_admin"
ON public.usuarios_reconciliacion_log
FOR SELECT
TO authenticated
USING (public.current_rol() = 'empresa_admin');

-- Bloquea mutaciones desde el cliente (solo service_role vía server)
CREATE OR REPLACE FUNCTION public.block_recon_log_mutations()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  RAISE EXCEPTION 'usuarios_reconciliacion_log es append-only por servidor: % bloqueado', tg_op
    USING errcode = 'insufficient_privilege';
END;
$fn$;

CREATE TRIGGER trg_block_recon_log_update
BEFORE UPDATE OR DELETE ON public.usuarios_reconciliacion_log
FOR EACH ROW EXECUTE FUNCTION public.block_recon_log_mutations();
