
-- 1) Revoke anon execute on cedula lookup (now called via server function using admin key)
REVOKE EXECUTE ON FUNCTION public.get_login_email_by_cedula(text) FROM anon, authenticated, PUBLIC;

-- 2) Storage: replace pausas-media policies with company-scoped path checks + add SELECT
DROP POLICY IF EXISTS pausas_media_insert ON storage.objects;
DROP POLICY IF EXISTS pausas_media_update ON storage.objects;
DROP POLICY IF EXISTS pausas_media_delete ON storage.objects;
DROP POLICY IF EXISTS pausas_media_select ON storage.objects;

-- Read: signed-in users can read shared 'oficiales/' assets;
-- otherwise the first path segment must match the caller's company id.
CREATE POLICY pausas_media_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pausas-media'
  AND (
    (storage.foldername(name))[1] = 'oficiales'
    OR (storage.foldername(name))[1] = public.current_empresa_id()::text
  )
);

CREATE POLICY pausas_media_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pausas-media'
  AND public.current_rol() IN ('prevencionista','empresa_admin')
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
);

CREATE POLICY pausas_media_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'pausas-media'
  AND public.current_rol() IN ('prevencionista','empresa_admin')
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
)
WITH CHECK (
  bucket_id = 'pausas-media'
  AND public.current_rol() IN ('prevencionista','empresa_admin')
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
);

CREATE POLICY pausas_media_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pausas-media'
  AND public.current_rol() IN ('prevencionista','empresa_admin')
  AND (storage.foldername(name))[1] = public.current_empresa_id()::text
);
