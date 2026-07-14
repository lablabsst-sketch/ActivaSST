
-- =========================================================
-- FIX 1: Move SECURITY DEFINER helpers to `private` schema
-- so they are no longer exposed via PostgREST (satisfies
-- Supabase linter 0029). Recreate all policies to use them.
-- =========================================================

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.current_rol()
 RETURNS public.rol_usuario
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT rol FROM public.usuarios WHERE id = auth.uid() $$;

CREATE OR REPLACE FUNCTION private.current_empresa_id()
 RETURNS uuid
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT empresa_id FROM public.usuarios WHERE id = auth.uid() $$;

REVOKE ALL ON FUNCTION private.current_rol() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_empresa_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_rol() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_empresa_id() TO authenticated, service_role;

-- Drop and recreate all policies referencing public helpers.

-- consentimientos: no helper refs (skip)

-- pausas_oficiales_ocultas
DROP POLICY IF EXISTS pof_ocultas_select ON public.pausas_oficiales_ocultas;
DROP POLICY IF EXISTS pof_ocultas_write ON public.pausas_oficiales_ocultas;
CREATE POLICY pof_ocultas_select ON public.pausas_oficiales_ocultas
  FOR SELECT TO authenticated
  USING (empresa_id = private.current_empresa_id());
CREATE POLICY pof_ocultas_write ON public.pausas_oficiales_ocultas
  FOR ALL TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'))
  WITH CHECK (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));

-- programaciones
DROP POLICY IF EXISTS prog_delete ON public.programaciones;
DROP POLICY IF EXISTS prog_insert ON public.programaciones;
DROP POLICY IF EXISTS prog_select ON public.programaciones;
DROP POLICY IF EXISTS prog_update ON public.programaciones;
CREATE POLICY prog_delete ON public.programaciones
  FOR DELETE TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));
CREATE POLICY prog_insert ON public.programaciones
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin') AND creador_id = auth.uid());
CREATE POLICY prog_select ON public.programaciones
  FOR SELECT TO authenticated
  USING (empresa_id = private.current_empresa_id());
CREATE POLICY prog_update ON public.programaciones
  FOR UPDATE TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'))
  WITH CHECK (empresa_id = private.current_empresa_id());

-- solicitudes_arco
DROP POLICY IF EXISTS arco_insert_self ON public.solicitudes_arco;
DROP POLICY IF EXISTS arco_select_staff ON public.solicitudes_arco;
DROP POLICY IF EXISTS arco_update_staff ON public.solicitudes_arco;
CREATE POLICY arco_insert_self ON public.solicitudes_arco
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid() AND empresa_id = private.current_empresa_id() AND estado = 'pendiente');
CREATE POLICY arco_select_staff ON public.solicitudes_arco
  FOR SELECT TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));
CREATE POLICY arco_update_staff ON public.solicitudes_arco
  FOR UPDATE TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'))
  WITH CHECK (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));

-- pausa_tipos_trabajo
DROP POLICY IF EXISTS ptt_select ON public.pausa_tipos_trabajo;
DROP POLICY IF EXISTS ptt_write ON public.pausa_tipos_trabajo;
CREATE POLICY ptt_select ON public.pausa_tipos_trabajo
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.pausas p WHERE p.id = pausa_tipos_trabajo.pausa_id AND p.empresa_id = private.current_empresa_id()));
CREATE POLICY ptt_write ON public.pausa_tipos_trabajo
  FOR ALL TO authenticated
  USING (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.pausas p WHERE p.id = pausa_tipos_trabajo.pausa_id AND p.empresa_id = private.current_empresa_id()))
  WITH CHECK (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.pausas p WHERE p.id = pausa_tipos_trabajo.pausa_id AND p.empresa_id = private.current_empresa_id()));

-- programacion_trabajadores
DROP POLICY IF EXISTS pt_select_staff ON public.programacion_trabajadores;
DROP POLICY IF EXISTS pt_write ON public.programacion_trabajadores;
CREATE POLICY pt_select_staff ON public.programacion_trabajadores
  FOR SELECT TO authenticated
  USING (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.programaciones p WHERE p.id = programacion_trabajadores.programacion_id AND p.empresa_id = private.current_empresa_id()));
CREATE POLICY pt_write ON public.programacion_trabajadores
  FOR ALL TO authenticated
  USING (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.programaciones p WHERE p.id = programacion_trabajadores.programacion_id AND p.empresa_id = private.current_empresa_id()))
  WITH CHECK (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.programaciones p WHERE p.id = programacion_trabajadores.programacion_id AND p.empresa_id = private.current_empresa_id()));

-- empresas
DROP POLICY IF EXISTS empresas_select ON public.empresas;
DROP POLICY IF EXISTS empresas_update ON public.empresas;
CREATE POLICY empresas_select ON public.empresas
  FOR SELECT TO authenticated
  USING (id = private.current_empresa_id());
CREATE POLICY empresas_update ON public.empresas
  FOR UPDATE TO authenticated
  USING (id = private.current_empresa_id() AND private.current_rol() = 'empresa_admin')
  WITH CHECK (id = private.current_empresa_id());

-- pausas_oficiales
DROP POLICY IF EXISTS pof_select ON public.pausas_oficiales;
DROP POLICY IF EXISTS pof_write ON public.pausas_oficiales;
CREATE POLICY pof_select ON public.pausas_oficiales
  FOR SELECT TO authenticated
  USING (empresa_id IS NULL OR empresa_id = private.current_empresa_id());
CREATE POLICY pof_write ON public.pausas_oficiales
  FOR ALL TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'))
  WITH CHECK (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));

-- pausas
DROP POLICY IF EXISTS pausas_select ON public.pausas;
DROP POLICY IF EXISTS pausas_write ON public.pausas;
CREATE POLICY pausas_select ON public.pausas
  FOR SELECT TO authenticated
  USING (empresa_id = private.current_empresa_id());
CREATE POLICY pausas_write ON public.pausas
  FOR ALL TO authenticated
  USING (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'))
  WITH CHECK (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin') AND creador_id = auth.uid());

-- usuarios_reconciliacion_log
DROP POLICY IF EXISTS recon_log_read_admin ON public.usuarios_reconciliacion_log;
CREATE POLICY recon_log_read_admin ON public.usuarios_reconciliacion_log
  FOR SELECT TO authenticated
  USING (private.current_rol() = 'empresa_admin');

-- usuarios
DROP POLICY IF EXISTS usuarios_insert ON public.usuarios;
DROP POLICY IF EXISTS usuarios_select ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_self ON public.usuarios;
DROP POLICY IF EXISTS usuarios_update_staff ON public.usuarios;
CREATE POLICY usuarios_insert ON public.usuarios
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));
CREATE POLICY usuarios_select ON public.usuarios
  FOR SELECT TO authenticated
  USING (empresa_id = private.current_empresa_id());
-- Self-update: WITH CHECK still restricts, but real enforcement is in trigger below (OLD-row semantics).
CREATE POLICY usuarios_update_self ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND empresa_id = private.current_empresa_id());
-- Staff-update: scoped to authenticated only (was {public}); role change constraints enforced by trigger.
CREATE POLICY usuarios_update_staff ON public.usuarios
  FOR UPDATE TO authenticated
  USING (id <> auth.uid() AND empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'))
  WITH CHECK (id <> auth.uid() AND empresa_id = private.current_empresa_id() AND private.current_rol() IN ('prevencionista','empresa_admin'));

-- usuario_tipos_trabajo
DROP POLICY IF EXISTS utt_select ON public.usuario_tipos_trabajo;
DROP POLICY IF EXISTS utt_write ON public.usuario_tipos_trabajo;
CREATE POLICY utt_select ON public.usuario_tipos_trabajo
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = usuario_tipos_trabajo.usuario_id AND u.empresa_id = private.current_empresa_id()));
CREATE POLICY utt_write ON public.usuario_tipos_trabajo
  FOR ALL TO authenticated
  USING (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = usuario_tipos_trabajo.usuario_id AND u.empresa_id = private.current_empresa_id()))
  WITH CHECK (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.usuarios u WHERE u.id = usuario_tipos_trabajo.usuario_id AND u.empresa_id = private.current_empresa_id()));

-- pausa_registros (FIX 4: tighten reg_insert_self)
DROP POLICY IF EXISTS reg_insert_self ON public.pausa_registros;
DROP POLICY IF EXISTS reg_select_staff ON public.pausa_registros;
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
    )
    AND EXISTS (
      SELECT 1 FROM public.programacion_trabajadores pt
      WHERE pt.programacion_id = pausa_registros.programacion_id
        AND pt.trabajador_id = auth.uid()
    )
  );
CREATE POLICY reg_select_staff ON public.pausa_registros
  FOR SELECT TO authenticated
  USING (private.current_rol() IN ('prevencionista','empresa_admin') AND EXISTS (SELECT 1 FROM public.programaciones p WHERE p.id = pausa_registros.programacion_id AND p.empresa_id = private.current_empresa_id()));

-- storage.objects policies (FIX 2 + FIX 3)
DROP POLICY IF EXISTS pausas_media_delete ON storage.objects;
DROP POLICY IF EXISTS pausas_media_insert ON storage.objects;
DROP POLICY IF EXISTS pausas_media_select ON storage.objects;
DROP POLICY IF EXISTS pausas_media_update ON storage.objects;

-- SELECT: oficiales folder now restricted to files referenced by a visible pausas_oficiales row
CREATE POLICY pausas_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'pausas-media'
    AND (
      (storage.foldername(name))[1] = (private.current_empresa_id())::text
      OR (
        (storage.foldername(name))[1] = 'oficiales'
        AND EXISTS (
          SELECT 1 FROM public.pausas_oficiales po
          WHERE (po.empresa_id IS NULL OR po.empresa_id = private.current_empresa_id())
            AND (po.image_url = objects.name OR po.video_url = objects.name)
        )
      )
    )
  );

CREATE POLICY pausas_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pausas-media'
    AND private.current_rol() IN ('prevencionista','empresa_admin')
    AND (storage.foldername(name))[1] = (private.current_empresa_id())::text
  );

-- UPDATE/DELETE: require file to be tied to a specific pausa record in caller's empresa.
-- Even empresa_admins can only touch files linked to a pausa row (not orphaned files),
-- and the pausa's creador_id must match caller for prevencionistas.
CREATE POLICY pausas_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'pausas-media'
    AND (storage.foldername(name))[1] = (private.current_empresa_id())::text
    AND EXISTS (
      SELECT 1 FROM public.pausas p
      WHERE p.empresa_id = private.current_empresa_id()
        AND (p.image_url = objects.name OR p.video_url = objects.name)
        AND (private.current_rol() = 'empresa_admin' OR p.creador_id = auth.uid())
    )
  );

CREATE POLICY pausas_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'pausas-media'
    AND (storage.foldername(name))[1] = (private.current_empresa_id())::text
    AND EXISTS (
      SELECT 1 FROM public.pausas p
      WHERE p.empresa_id = private.current_empresa_id()
        AND (p.image_url = objects.name OR p.video_url = objects.name)
        AND (private.current_rol() = 'empresa_admin' OR p.creador_id = auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'pausas-media'
    AND (storage.foldername(name))[1] = (private.current_empresa_id())::text
    AND EXISTS (
      SELECT 1 FROM public.pausas p
      WHERE p.empresa_id = private.current_empresa_id()
        AND (p.image_url = objects.name OR p.video_url = objects.name)
        AND (private.current_rol() = 'empresa_admin' OR p.creador_id = auth.uid())
    )
  );

-- Now drop the public schema helpers (no longer referenced by any policy).
-- Update other public SECURITY DEFINER functions that referenced them.
CREATE OR REPLACE FUNCTION public.check_plan_limit()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_limit int; v_plan_nombre text; v_actual int;
begin
  if new.rol <> 'trabajador' then return new; end if;
  if new.estado not in ('pendiente', 'activo') then return new; end if;
  if tg_op = 'UPDATE'
     and old.rol = 'trabajador'
     and old.estado in ('pendiente', 'activo')
     and old.empresa_id = new.empresa_id then
    return new;
  end if;
  select p.max_trabajadores, p.nombre into v_limit, v_plan_nombre
    from public.empresas e join public.planes p on p.id = e.plan_id
    where e.id = new.empresa_id;
  if v_limit is null then
    raise exception 'Empresa % no tiene plan asignado', new.empresa_id using errcode = 'check_violation';
  end if;
  select count(*) into v_actual from public.usuarios
    where empresa_id = new.empresa_id and rol = 'trabajador'
      and estado in ('pendiente','activo') and id <> new.id;
  if v_actual + 1 > v_limit then
    raise exception 'Has alcanzado el límite del plan % (% trabajadores). Actualiza tu plan para sumar más usuarios.',
      v_plan_nombre, v_limit using errcode = 'check_violation';
  end if;
  return new;
end $function$;

DROP FUNCTION IF EXISTS public.current_rol();
DROP FUNCTION IF EXISTS public.current_empresa_id();

-- =========================================================
-- FIX 5 + 6: Trigger to prevent role/estado escalation using
-- OLD-row semantics (self-escalation and staff-abuse-proof).
-- =========================================================
CREATE OR REPLACE FUNCTION private.enforce_usuarios_role_rules()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_caller_rol public.rol_usuario;
BEGIN
  -- Service role bypass (edge functions / admin ops).
  IF current_setting('request.jwt.claim.role', true) = 'service_role'
     OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT rol INTO v_caller_rol FROM public.usuarios WHERE id = auth.uid();

  -- Self-update: never allow changing own rol or estado.
  IF NEW.id = auth.uid() THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      RAISE EXCEPTION 'No puedes cambiar tu propio rol' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.estado IS DISTINCT FROM OLD.estado THEN
      RAISE EXCEPTION 'No puedes cambiar tu propio estado' USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  -- Staff updating others.
  IF v_caller_rol = 'prevencionista' THEN
    -- Prevencionistas cannot touch admins, and cannot promote to admin.
    IF OLD.rol = 'empresa_admin' OR NEW.rol = 'empresa_admin' THEN
      RAISE EXCEPTION 'Solo un empresa_admin puede modificar el rol empresa_admin' USING ERRCODE = 'insufficient_privilege';
    END IF;
    -- Prevencionistas cannot change roles at all (only manage estado/other fields).
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      RAISE EXCEPTION 'Solo un empresa_admin puede cambiar roles' USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF v_caller_rol = 'empresa_admin' THEN
    -- Admin can change roles within their empresa but not demote the last admin.
    IF OLD.rol = 'empresa_admin' AND NEW.rol <> 'empresa_admin' THEN
      IF (SELECT count(*) FROM public.usuarios
            WHERE empresa_id = OLD.empresa_id
              AND rol = 'empresa_admin'
              AND estado IN ('pendiente','activo')
              AND id <> OLD.id) = 0 THEN
        RAISE EXCEPTION 'Debe existir al menos un empresa_admin activo' USING ERRCODE = 'insufficient_privilege';
      END IF;
    END IF;
  END IF;

  -- Nobody may move a row across empresas via UPDATE.
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'No se puede cambiar la empresa de un usuario' USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION private.enforce_usuarios_role_rules() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_usuarios_role_rules ON public.usuarios;
CREATE TRIGGER enforce_usuarios_role_rules
  BEFORE UPDATE ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION private.enforce_usuarios_role_rules();
