
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_login_email_by_cedula(p_cedula text)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.usuarios
   WHERE documento = p_cedula
     AND estado IN ('activo','pendiente')
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mark_password_set()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.usuarios SET password_set = true WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_password_set()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT password_set FROM public.usuarios WHERE id = auth.uid()), false);
$$;

GRANT EXECUTE ON FUNCTION public.get_login_email_by_cedula(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_password_set() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_password_set() TO authenticated;
