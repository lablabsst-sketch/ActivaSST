
CREATE OR REPLACE FUNCTION public.mark_password_set()
  RETURNS void
  LANGUAGE sql
  SECURITY INVOKER
  SET search_path = public
AS $$
  UPDATE public.usuarios SET password_set = true WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.mark_password_set() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_password_set() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_login_email_by_cedula(text) FROM authenticated;
