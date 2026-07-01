
-- Fix reg_insert_self: restore programacion_trabajadores assignment check
DROP POLICY IF EXISTS reg_insert_self ON public.pausa_registros;
CREATE POLICY reg_insert_self ON public.pausa_registros
  FOR INSERT TO authenticated
  WITH CHECK (
    trabajador_id = auth.uid()
    AND estado::text IN ('hecha','rechazada','postpuesta')
    AND EXISTS (
      SELECT 1 FROM public.programaciones p
      WHERE p.id = pausa_registros.programacion_id
        AND p.empresa_id = current_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.programacion_trabajadores pt
      WHERE pt.programacion_id = pausa_registros.programacion_id
        AND pt.trabajador_id = auth.uid()
    )
  );

-- Prevent role/empresa escalation on self-update
DROP POLICY IF EXISTS usuarios_update_self ON public.usuarios;
CREATE POLICY usuarios_update_self ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND empresa_id = current_empresa_id()
    AND rol = (SELECT u.rol FROM public.usuarios u WHERE u.id = auth.uid())
  );

-- Staff update: only empresa_admin can change rol
DROP POLICY IF EXISTS usuarios_update_staff ON public.usuarios;
CREATE POLICY usuarios_update_staff ON public.usuarios
  FOR UPDATE TO authenticated
  USING (
    empresa_id = current_empresa_id()
    AND current_rol() = ANY (ARRAY['prevencionista'::rol_usuario, 'empresa_admin'::rol_usuario])
  )
  WITH CHECK (
    empresa_id = current_empresa_id()
    AND (
      current_rol() = 'empresa_admin'::rol_usuario
      OR rol = (SELECT u.rol FROM public.usuarios u WHERE u.id = usuarios.id)
    )
  );

-- Set search_path on trigger functions missing it
CREATE OR REPLACE FUNCTION public.block_pausa_registros_mutations()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
begin
  raise exception 'pausa_registros es append-only: % bloqueado', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

CREATE OR REPLACE FUNCTION public.stamp_respondido_en()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
begin
  new.respondido_en := now();
  return new;
end;
$$;

CREATE OR REPLACE FUNCTION public.sync_usuario_activo()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = public
AS $$
begin
  new.activo := new.estado in ('pendiente', 'activo');
  return new;
end;
$$;

-- Lock down SECURITY DEFINER function execution privileges.
-- Trigger functions never need EXECUTE by users.
REVOKE ALL ON FUNCTION public.check_plan_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_email_whitelist() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_usuario_activo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stamp_respondido_en() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_pausa_registros_mutations() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Helpers called only from RLS policies: RLS evaluates them via SECURITY DEFINER;
-- revoke direct EXECUTE from clients.
REVOKE ALL ON FUNCTION public.current_rol() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_empresa_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_password_set() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.email_is_whitelisted(text) FROM PUBLIC, anon, authenticated;

-- Functions callable from client via RPC: restrict to the minimum audience.
REVOKE ALL ON FUNCTION public.mark_password_set() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_set() TO authenticated;

-- Login lookup runs pre-auth; keep anon/authenticated EXECUTE, revoke PUBLIC.
REVOKE ALL ON FUNCTION public.get_login_email_by_cedula(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_login_email_by_cedula(text) TO anon, authenticated;
