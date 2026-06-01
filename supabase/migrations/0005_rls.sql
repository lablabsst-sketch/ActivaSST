-- 0005_rls.sql
-- Activa SST — Row Level Security en todas las tablas.
-- Principio II de la constitución: ninguna tabla queda sin RLS.

-- ============================================================
-- Habilitar RLS
-- ============================================================
alter table public.empresas                 enable row level security;
alter table public.usuarios                 enable row level security;
alter table public.tipos_trabajo            enable row level security;
alter table public.usuario_tipos_trabajo    enable row level security;
alter table public.pausas                   enable row level security;
alter table public.pausa_tipos_trabajo      enable row level security;
alter table public.programaciones           enable row level security;
alter table public.programacion_trabajadores enable row level security;
alter table public.pausa_registros          enable row level security;
alter table public.push_subscriptions       enable row level security;
alter table public.consentimientos          enable row level security;

-- ============================================================
-- empresas: cada usuario ve su propia empresa. Solo empresa_admin puede actualizar.
-- ============================================================
drop policy if exists empresas_select on public.empresas;
create policy empresas_select on public.empresas
  for select to authenticated
  using (id = public.current_empresa_id());

drop policy if exists empresas_update on public.empresas;
create policy empresas_update on public.empresas
  for update to authenticated
  using (id = public.current_empresa_id() and public.current_rol() = 'empresa_admin')
  with check (id = public.current_empresa_id());

-- INSERT y DELETE de empresas se hace solo por backoffice (service_role), no por usuarios.

-- ============================================================
-- usuarios:
-- - SELECT: todos los usuarios de la misma empresa pueden verse entre sí.
-- - INSERT: prevencionistas y empresa_admin pueden crear (al importar CSV/agregar trabajadores).
-- - UPDATE: cada quien su propio perfil; prevencionistas pueden marcar activo=false a trabajadores.
-- - DELETE: prohibido (preservar histórico).
-- ============================================================
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (empresa_id = public.current_empresa_id());

drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios
  for insert to authenticated
  with check (
    empresa_id = public.current_empresa_id()
    and public.current_rol() in ('prevencionista', 'empresa_admin')
  );

drop policy if exists usuarios_update_self on public.usuarios;
create policy usuarios_update_self on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and empresa_id = public.current_empresa_id());

drop policy if exists usuarios_update_staff on public.usuarios;
create policy usuarios_update_staff on public.usuarios
  for update to authenticated
  using (
    empresa_id = public.current_empresa_id()
    and public.current_rol() in ('prevencionista', 'empresa_admin')
  )
  with check (empresa_id = public.current_empresa_id());

-- ============================================================
-- tipos_trabajo: catálogo global, lectura para todo authenticated. Escritura solo service_role.
-- ============================================================
drop policy if exists tipos_select on public.tipos_trabajo;
create policy tipos_select on public.tipos_trabajo
  for select to authenticated
  using (true);

-- ============================================================
-- usuario_tipos_trabajo: prevencionistas/admins gestionan, todos en la empresa leen.
-- ============================================================
drop policy if exists utt_select on public.usuario_tipos_trabajo;
create policy utt_select on public.usuario_tipos_trabajo
  for select to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = usuario_tipos_trabajo.usuario_id
        and u.empresa_id = public.current_empresa_id()
    )
  );

drop policy if exists utt_write on public.usuario_tipos_trabajo;
create policy utt_write on public.usuario_tipos_trabajo
  for all to authenticated
  using (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.usuarios u
      where u.id = usuario_tipos_trabajo.usuario_id
        and u.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.usuarios u
      where u.id = usuario_tipos_trabajo.usuario_id
        and u.empresa_id = public.current_empresa_id()
    )
  );

-- ============================================================
-- pausas: lectura para toda la empresa, escritura solo prevencionistas/admins.
-- ============================================================
drop policy if exists pausas_select on public.pausas;
create policy pausas_select on public.pausas
  for select to authenticated
  using (empresa_id = public.current_empresa_id());

drop policy if exists pausas_write on public.pausas;
create policy pausas_write on public.pausas
  for all to authenticated
  using (
    empresa_id = public.current_empresa_id()
    and public.current_rol() in ('prevencionista', 'empresa_admin')
  )
  with check (
    empresa_id = public.current_empresa_id()
    and public.current_rol() in ('prevencionista', 'empresa_admin')
    and creador_id = auth.uid()
  );

-- ============================================================
-- pausa_tipos_trabajo: lectura empresa, escritura staff.
-- ============================================================
drop policy if exists ptt_select on public.pausa_tipos_trabajo;
create policy ptt_select on public.pausa_tipos_trabajo
  for select to authenticated
  using (
    exists (
      select 1 from public.pausas p
      where p.id = pausa_tipos_trabajo.pausa_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

drop policy if exists ptt_write on public.pausa_tipos_trabajo;
create policy ptt_write on public.pausa_tipos_trabajo
  for all to authenticated
  using (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.pausas p
      where p.id = pausa_tipos_trabajo.pausa_id
        and p.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.pausas p
      where p.id = pausa_tipos_trabajo.pausa_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

-- ============================================================
-- programaciones: lectura empresa, escritura staff. UPDATE limitado a procesada_at por
-- service_role (scheduler). authenticated solo INSERT y SELECT.
-- ============================================================
drop policy if exists prog_select on public.programaciones;
create policy prog_select on public.programaciones
  for select to authenticated
  using (empresa_id = public.current_empresa_id());

drop policy if exists prog_insert on public.programaciones;
create policy prog_insert on public.programaciones
  for insert to authenticated
  with check (
    empresa_id = public.current_empresa_id()
    and public.current_rol() in ('prevencionista', 'empresa_admin')
    and creador_id = auth.uid()
  );

-- UPDATE solo permitido al creador (para reprogramar antes de procesada_at).
drop policy if exists prog_update on public.programaciones;
create policy prog_update on public.programaciones
  for update to authenticated
  using (
    empresa_id = public.current_empresa_id()
    and creador_id = auth.uid()
    and procesada_at is null
  )
  with check (empresa_id = public.current_empresa_id());

-- ============================================================
-- programacion_trabajadores: lectura empresa, escritura staff vía la programación.
-- Trabajadores ven solo sus propias filas (para listar "mis pausas pendientes").
-- ============================================================
drop policy if exists pt_select_staff on public.programacion_trabajadores;
create policy pt_select_staff on public.programacion_trabajadores
  for select to authenticated
  using (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.programaciones p
      where p.id = programacion_trabajadores.programacion_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

drop policy if exists pt_select_self on public.programacion_trabajadores;
create policy pt_select_self on public.programacion_trabajadores
  for select to authenticated
  using (trabajador_id = auth.uid());

drop policy if exists pt_write on public.programacion_trabajadores;
create policy pt_write on public.programacion_trabajadores
  for all to authenticated
  using (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.programaciones p
      where p.id = programacion_trabajadores.programacion_id
        and p.empresa_id = public.current_empresa_id()
    )
  )
  with check (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.programaciones p
      where p.id = programacion_trabajadores.programacion_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

-- ============================================================
-- pausa_registros: APPEND-ONLY.
-- - SELECT: el trabajador ve los suyos; staff ve todos los de su empresa.
-- - INSERT: el trabajador solo puede insertar para sí mismo, y solo si está en programacion_trabajadores.
-- - UPDATE/DELETE: BLOQUEADO por trigger en 0006_audit.sql (defensa en profundidad).
-- ============================================================
drop policy if exists reg_select_self on public.pausa_registros;
create policy reg_select_self on public.pausa_registros
  for select to authenticated
  using (trabajador_id = auth.uid());

drop policy if exists reg_select_staff on public.pausa_registros;
create policy reg_select_staff on public.pausa_registros
  for select to authenticated
  using (
    public.current_rol() in ('prevencionista', 'empresa_admin')
    and exists (
      select 1 from public.programaciones p
      where p.id = pausa_registros.programacion_id
        and p.empresa_id = public.current_empresa_id()
    )
  );

drop policy if exists reg_insert_self on public.pausa_registros;
create policy reg_insert_self on public.pausa_registros
  for insert to authenticated
  with check (
    trabajador_id = auth.uid()
    and estado in ('hecha', 'rechazada')  -- 'pendiente' y 'vencida' solo los inserta el scheduler
    and exists (
      select 1 from public.programacion_trabajadores pt
      where pt.programacion_id = pausa_registros.programacion_id
        and pt.trabajador_id = auth.uid()
    )
  );

-- Sin política UPDATE ni DELETE → con RLS habilitada, esto ya las prohíbe para authenticated.
-- El trigger en 0006_audit.sql añade defensa contra service_role/postgres.

-- ============================================================
-- push_subscriptions: cada usuario gestiona las suyas.
-- ============================================================
drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists push_write on public.push_subscriptions;
create policy push_write on public.push_subscriptions
  for all to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- ============================================================
-- consentimientos: cada usuario ve y agrega los suyos. UPDATE limitado (para revocar).
-- ============================================================
drop policy if exists consent_select on public.consentimientos;
create policy consent_select on public.consentimientos
  for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists consent_insert on public.consentimientos;
create policy consent_insert on public.consentimientos
  for insert to authenticated
  with check (usuario_id = auth.uid());

drop policy if exists consent_update_revoke on public.consentimientos;
create policy consent_update_revoke on public.consentimientos
  for update to authenticated
  using (usuario_id = auth.uid() and revocado_at is null)
  with check (usuario_id = auth.uid() and revocado_at is not null);

-- ============================================================
-- Storage: bucket pausas-media
-- Lectura pública (definida en 0002 con public=true). Escritura solo staff.
-- ============================================================
drop policy if exists pausas_media_insert on storage.objects;
create policy pausas_media_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pausas-media'
    and public.current_rol() in ('prevencionista', 'empresa_admin')
  );

drop policy if exists pausas_media_update on storage.objects;
create policy pausas_media_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pausas-media'
    and public.current_rol() in ('prevencionista', 'empresa_admin')
  );

drop policy if exists pausas_media_delete on storage.objects;
create policy pausas_media_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pausas-media'
    and public.current_rol() in ('prevencionista', 'empresa_admin')
  );
