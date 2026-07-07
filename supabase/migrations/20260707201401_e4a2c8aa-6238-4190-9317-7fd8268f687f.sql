
-- 1) Convert helper functions to SECURITY INVOKER (usuarios RLS already
--    lets a user read their own row within their company, so no elevation needed)
ALTER FUNCTION public.current_rol() SECURITY INVOKER;
ALTER FUNCTION public.current_empresa_id() SECURITY INVOKER;
ALTER FUNCTION public.current_password_set() SECURITY INVOKER;

-- 2) Tighten usuarios UPDATE policies to prevent role escalation via
--    the permissive staff path when the subject is the acting user, and
--    prevent prevencionistas from touching empresa_admin accounts.
DROP POLICY IF EXISTS usuarios_update_staff ON public.usuarios;
CREATE POLICY usuarios_update_staff ON public.usuarios
FOR UPDATE
USING (
  id <> auth.uid()
  AND empresa_id = public.current_empresa_id()
  AND public.current_rol() = ANY (ARRAY['prevencionista'::rol_usuario, 'empresa_admin'::rol_usuario])
  AND (
    public.current_rol() = 'empresa_admin'::rol_usuario
    OR (SELECT u.rol FROM public.usuarios u WHERE u.id = usuarios.id) <> 'empresa_admin'::rol_usuario
  )
)
WITH CHECK (
  id <> auth.uid()
  AND empresa_id = public.current_empresa_id()
  AND (
    public.current_rol() = 'empresa_admin'::rol_usuario
    OR (
      rol = (SELECT u.rol FROM public.usuarios u WHERE u.id = usuarios.id)
      AND (SELECT u.rol FROM public.usuarios u WHERE u.id = usuarios.id) <> 'empresa_admin'::rol_usuario
    )
  )
);

-- 3) Add file-level ownership check to pausas-media UPDATE/DELETE:
--    empresa_admin may manage any company file; prevencionistas only files
--    referenced by a pausa they created.
DROP POLICY IF EXISTS pausas_media_update ON storage.objects;
DROP POLICY IF EXISTS pausas_media_delete ON storage.objects;

CREATE POLICY pausas_media_update ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'pausas-media'
  AND (storage.foldername(name))[1] = (public.current_empresa_id())::text
  AND (
    public.current_rol() = 'empresa_admin'::rol_usuario
    OR (
      public.current_rol() = 'prevencionista'::rol_usuario
      AND EXISTS (
        SELECT 1 FROM public.pausas p
        WHERE p.empresa_id = public.current_empresa_id()
          AND p.creador_id = auth.uid()
          AND (p.image_url = storage.objects.name OR p.video_url = storage.objects.name)
      )
    )
  )
)
WITH CHECK (
  bucket_id = 'pausas-media'
  AND (storage.foldername(name))[1] = (public.current_empresa_id())::text
  AND (
    public.current_rol() = 'empresa_admin'::rol_usuario
    OR (
      public.current_rol() = 'prevencionista'::rol_usuario
      AND EXISTS (
        SELECT 1 FROM public.pausas p
        WHERE p.empresa_id = public.current_empresa_id()
          AND p.creador_id = auth.uid()
          AND (p.image_url = storage.objects.name OR p.video_url = storage.objects.name)
      )
    )
  )
);

CREATE POLICY pausas_media_delete ON storage.objects
FOR DELETE
USING (
  bucket_id = 'pausas-media'
  AND (storage.foldername(name))[1] = (public.current_empresa_id())::text
  AND (
    public.current_rol() = 'empresa_admin'::rol_usuario
    OR (
      public.current_rol() = 'prevencionista'::rol_usuario
      AND EXISTS (
        SELECT 1 FROM public.pausas p
        WHERE p.empresa_id = public.current_empresa_id()
          AND p.creador_id = auth.uid()
          AND (p.image_url = storage.objects.name OR p.video_url = storage.objects.name)
      )
    )
  )
);
