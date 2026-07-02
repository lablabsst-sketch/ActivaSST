
CREATE OR REPLACE FUNCTION public.reconciliar_usuarios_auth(p_origen TEXT DEFAULT 'cron')
RETURNS public.usuarios_reconciliacion_log
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_total INT;
  v_ids UUID[];
  v_auth_ids UUID[];
  v_log public.usuarios_reconciliacion_log;
BEGIN
  SELECT COUNT(*) INTO v_total FROM public.usuarios WHERE password_set = true;

  -- Huérfanas: password_set=true pero sin cuenta en auth.users
  WITH huerfanas AS (
    SELECT u.id
    FROM public.usuarios u
    WHERE u.password_set = true
      AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = u.id)
  ),
  reset AS (
    UPDATE public.usuarios u
       SET password_set = false
      FROM huerfanas h
     WHERE u.id = h.id
    RETURNING u.id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM reset;

  -- auth.users sin perfil en public.usuarios (solo reporte)
  SELECT COALESCE(array_agg(au.id), '{}')
    INTO v_auth_ids
  FROM auth.users au
  WHERE NOT EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = au.id);

  INSERT INTO public.usuarios_reconciliacion_log (
    origen, total_revisados, huerfanas_detectadas, huerfanas_reseteadas,
    auth_sin_perfil, ids_reseteados, ids_auth_sin_perfil
  ) VALUES (
    p_origen, v_total, COALESCE(array_length(v_ids, 1), 0),
    COALESCE(array_length(v_ids, 1), 0),
    COALESCE(array_length(v_auth_ids, 1), 0),
    v_ids, v_auth_ids
  ) RETURNING * INTO v_log;

  RETURN v_log;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.reconciliar_usuarios_auth(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconciliar_usuarios_auth(TEXT) TO service_role;
