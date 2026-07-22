-- Lock down SECURITY DEFINER functions in public schema: revoke EXECUTE from anon and PUBLIC.
-- Keep authenticated grants only where policies/clients actually need them.
-- Private schema helpers (current_rol/current_empresa_id) already scoped to authenticated.

REVOKE EXECUTE ON FUNCTION public.check_plan_limit() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_password_set() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.diagnose_pausa_registro_insert(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.email_is_whitelisted(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.enforce_email_whitelist() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_login_email_by_cedula(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reconciliar_usuarios_auth(text) FROM anon, public;

-- Also make sure private helpers stay locked from anon/public
REVOKE EXECUTE ON FUNCTION private.current_rol() FROM anon, public;
REVOKE EXECUTE ON FUNCTION private.current_empresa_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION private.enforce_usuarios_role_rules() FROM anon, public;

-- Re-affirm authenticated grants where legitimately needed
GRANT EXECUTE ON FUNCTION public.current_password_set() TO authenticated;
GRANT EXECUTE ON FUNCTION public.diagnose_pausa_registro_insert(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_rol() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_empresa_id() TO authenticated;