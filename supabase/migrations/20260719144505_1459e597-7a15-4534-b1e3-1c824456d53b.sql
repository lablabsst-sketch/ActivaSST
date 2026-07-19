
CREATE OR REPLACE FUNCTION public.diagnose_pausa_registro_insert(
  p_programacion_id uuid
)
RETURNS TABLE(ok boolean, code text, message text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user_empresa uuid;
  v_prog RECORD;
  v_assigned_direct boolean;
  v_assigned_type boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 'no_session', 'No hay sesión activa'; RETURN;
  END IF;

  SELECT empresa_id INTO v_user_empresa FROM public.usuarios WHERE id = v_uid;
  IF v_user_empresa IS NULL THEN
    RETURN QUERY SELECT false, 'user_no_empresa', 'Tu perfil no tiene empresa asignada'; RETURN;
  END IF;

  SELECT id, empresa_id, activa, tipos_trabajo_objetivo
    INTO v_prog
    FROM public.programaciones
   WHERE id = p_programacion_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'prog_not_found', 'La programación no existe o no es visible'; RETURN;
  END IF;

  IF v_prog.empresa_id <> v_user_empresa THEN
    RETURN QUERY SELECT false, 'prog_other_empresa', 'La programación pertenece a otra empresa'; RETURN;
  END IF;

  IF v_prog.activa IS NOT TRUE THEN
    RETURN QUERY SELECT false, 'prog_inactiva', 'La programación está inactiva'; RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.programacion_trabajadores pt
     WHERE pt.programacion_id = v_prog.id AND pt.trabajador_id = v_uid
  ) INTO v_assigned_direct;

  IF v_assigned_direct THEN
    RETURN QUERY SELECT true, 'ok_direct', 'Asignación directa'; RETURN;
  END IF;

  IF v_prog.tipos_trabajo_objetivo IS NULL OR cardinality(v_prog.tipos_trabajo_objetivo) = 0 THEN
    RETURN QUERY SELECT true, 'ok_global', 'Programación abierta a toda la empresa'; RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.usuario_tipos_trabajo utt
     WHERE utt.usuario_id = v_uid
       AND utt.tipo_id = ANY (v_prog.tipos_trabajo_objetivo)
  ) INTO v_assigned_type;

  IF v_assigned_type THEN
    RETURN QUERY SELECT true, 'ok_type', 'Coincide por tipo de trabajo'; RETURN;
  END IF;

  RETURN QUERY SELECT false, 'no_assignment',
    'No estás asignado a esta programación (ni directa, ni por tipo de trabajo, ni es abierta)';
END;
$$;

REVOKE ALL ON FUNCTION public.diagnose_pausa_registro_insert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diagnose_pausa_registro_insert(uuid) TO authenticated;
