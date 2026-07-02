
DROP POLICY IF EXISTS usuarios_update_self ON public.usuarios;
CREATE POLICY usuarios_update_self ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND empresa_id = current_empresa_id()
    AND rol = (SELECT u.rol FROM public.usuarios u WHERE u.id = auth.uid())
    AND estado = (SELECT u.estado FROM public.usuarios u WHERE u.id = auth.uid())
  );
