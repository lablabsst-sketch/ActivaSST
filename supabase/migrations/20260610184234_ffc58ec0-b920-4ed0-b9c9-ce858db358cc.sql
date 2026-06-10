
-- 0) Vaciar datos transaccionales previos
TRUNCATE public.pausa_registros, public.programacion_trabajadores, public.programaciones RESTART IDENTITY CASCADE;

-- 0.1) Borrar primero todas las políticas que tocan columnas a eliminar/renombrar
DROP POLICY IF EXISTS prog_select ON public.programaciones;
DROP POLICY IF EXISTS prog_insert ON public.programaciones;
DROP POLICY IF EXISTS prog_update ON public.programaciones;
DROP POLICY IF EXISTS prog_delete ON public.programaciones;
DROP POLICY IF EXISTS reg_insert_self ON public.pausa_registros;
DROP POLICY IF EXISTS reg_select_self ON public.pausa_registros;
DROP POLICY IF EXISTS reg_select_staff ON public.pausa_registros;

-- 1) pausas_oficiales: catálogo base (empresa_id NULL) vs custom por empresa
ALTER TABLE public.pausas_oficiales
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS pausas_oficiales_empresa_idx ON public.pausas_oficiales(empresa_id);

-- 2) Tabla para ocultar pausas base por empresa
CREATE TABLE IF NOT EXISTS public.pausas_oficiales_ocultas (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pausa_oficial_id uuid NOT NULL REFERENCES public.pausas_oficiales(id) ON DELETE CASCADE,
  PRIMARY KEY (empresa_id, pausa_oficial_id)
);
GRANT SELECT, INSERT, DELETE ON public.pausas_oficiales_ocultas TO authenticated;
GRANT ALL ON public.pausas_oficiales_ocultas TO service_role;
ALTER TABLE public.pausas_oficiales_ocultas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pof_ocultas_select ON public.pausas_oficiales_ocultas;
CREATE POLICY pof_ocultas_select ON public.pausas_oficiales_ocultas
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
DROP POLICY IF EXISTS pof_ocultas_write ON public.pausas_oficiales_ocultas;
CREATE POLICY pof_ocultas_write ON public.pausas_oficiales_ocultas
  FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
  );

-- 3) Refrescar permisos de pausas_oficiales
DROP POLICY IF EXISTS pof_select ON public.pausas_oficiales;
CREATE POLICY pof_select ON public.pausas_oficiales
  FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = public.current_empresa_id());
DROP POLICY IF EXISTS pof_write ON public.pausas_oficiales;
CREATE POLICY pof_write ON public.pausas_oficiales
  FOR ALL TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
  );

-- 4) programaciones: rediseño a calendario semanal
ALTER TABLE public.programaciones DROP COLUMN IF EXISTS disparo_at;
ALTER TABLE public.programaciones DROP COLUMN IF EXISTS ventana_min;
ALTER TABLE public.programaciones DROP COLUMN IF EXISTS recurrencia_json;
ALTER TABLE public.programaciones DROP COLUMN IF EXISTS procesada_at;
ALTER TABLE public.programaciones DROP CONSTRAINT IF EXISTS programaciones_pausa_id_fkey;
ALTER TABLE public.programaciones RENAME COLUMN pausa_id TO pausa_oficial_id;
ALTER TABLE public.programaciones
  ADD CONSTRAINT programaciones_pausa_oficial_fkey
  FOREIGN KEY (pausa_oficial_id) REFERENCES public.pausas_oficiales(id) ON DELETE RESTRICT;
ALTER TABLE public.programaciones
  ADD COLUMN IF NOT EXISTS nombre text NOT NULL DEFAULT 'Programación',
  ADD COLUMN IF NOT EXISTS tipos_trabajo_objetivo uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dias_semana int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS horas time[] NOT NULL DEFAULT ARRAY['10:30','12:30','14:30','16:30']::time[],
  ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.programaciones ALTER COLUMN nombre DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_programaciones_touch ON public.programaciones;
CREATE TRIGGER trg_programaciones_touch BEFORE UPDATE ON public.programaciones
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY prog_select ON public.programaciones
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY prog_insert ON public.programaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
    AND creador_id = auth.uid()
  );
CREATE POLICY prog_update ON public.programaciones
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
  )
  WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY prog_delete ON public.programaciones
  FOR DELETE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND public.current_rol()::text IN ('prevencionista','empresa_admin')
  );

-- 6) pausa_registros: nuevas columnas + estado postpuesta
ALTER TYPE public.estado_registro ADD VALUE IF NOT EXISTS 'postpuesta';
ALTER TABLE public.pausa_registros
  ADD COLUMN IF NOT EXISTS pausa_oficial_id uuid REFERENCES public.pausas_oficiales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duracion_real_seg int;

CREATE POLICY reg_select_self ON public.pausa_registros
  FOR SELECT TO authenticated
  USING (trabajador_id = auth.uid());
CREATE POLICY reg_select_staff ON public.pausa_registros
  FOR SELECT TO authenticated
  USING (
    public.current_rol()::text IN ('prevencionista','empresa_admin')
    AND EXISTS (
      SELECT 1 FROM public.programaciones p
      WHERE p.id = pausa_registros.programacion_id
        AND p.empresa_id = public.current_empresa_id()
    )
  );
CREATE POLICY reg_insert_self ON public.pausa_registros
  FOR INSERT TO authenticated
  WITH CHECK (
    trabajador_id = auth.uid()
    AND estado::text IN ('hecha','rechazada','postpuesta')
    AND EXISTS (
      SELECT 1 FROM public.programaciones p
      WHERE p.id = pausa_registros.programacion_id
        AND p.empresa_id = public.current_empresa_id()
    )
  );
