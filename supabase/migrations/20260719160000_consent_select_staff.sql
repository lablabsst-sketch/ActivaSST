-- El prevencionista/empresa_admin necesita descargar la evidencia de Habeas Data
-- de cada trabajador (versión de aviso aceptada, fecha, finalidades, user_agent)
-- como soporte legal ante una investigación. La política consent_select solo
-- permitía al titular ver su propio consentimiento (usuario_id = auth.uid()),
-- por lo que el staff no podía leerlo.
--
-- Agregamos una política de SELECT adicional que autoriza al staff a leer los
-- consentimientos de los trabajadores de SU MISMA empresa. Reutiliza los helpers
-- SECURITY DEFINER current_rol()/current_empresa_id() (mismo patrón que
-- reg_select_staff sobre pausa_registros) para evitar recursión de RLS.
DROP POLICY IF EXISTS consent_select_staff ON public.consentimientos;
CREATE POLICY consent_select_staff ON public.consentimientos
  FOR SELECT TO authenticated
  USING (
    public.current_rol() IN ('prevencionista', 'empresa_admin')
    AND EXISTS (
      SELECT 1 FROM public.usuarios u
      WHERE u.id = consentimientos.usuario_id
        AND u.empresa_id = public.current_empresa_id()
    )
  );
