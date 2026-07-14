DROP POLICY IF EXISTS reg_insert_self ON public.pausa_registros;

CREATE POLICY reg_insert_self ON public.pausa_registros
  FOR INSERT TO authenticated
  WITH CHECK (
    trabajador_id = auth.uid()
    AND estado::text IN ('hecha','rechazada','postpuesta')
    AND EXISTS (
      SELECT 1 FROM public.programaciones p
      WHERE p.id = pausa_registros.programacion_id
        AND p.empresa_id = private.current_empresa_id()
        AND p.activa = true
        AND (
          EXISTS (
            SELECT 1 FROM public.programacion_trabajadores pt
            WHERE pt.programacion_id = p.id
              AND pt.trabajador_id = auth.uid()
          )
          OR p.tipos_trabajo_objetivo IS NULL
          OR cardinality(p.tipos_trabajo_objetivo) = 0
          OR EXISTS (
            SELECT 1 FROM public.usuario_tipos_trabajo utt
            WHERE utt.usuario_id = auth.uid()
              AND utt.tipo_id = ANY (p.tipos_trabajo_objetivo)
          )
        )
    )
  );