-- 0002_pausas.sql
-- Activa SST — biblioteca de pausas y vínculo con tipos de trabajo.

-- ============================================================
-- Tabla: pausas
-- Contenido reutilizable (principio IV de la constitución).
-- ============================================================
create table if not exists public.pausas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas(id) on delete restrict,
  titulo        text not null check (char_length(titulo) between 2 and 200),
  instrucciones text not null check (char_length(instrucciones) between 1 and 5000),
  duracion_min  smallint not null check (duracion_min between 1 and 60),
  image_url     text,
  video_url     text,
  creador_id    uuid not null references public.usuarios(id) on delete restrict,
  archivada     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists idx_pausas_empresa on public.pausas(empresa_id) where not archivada;

comment on table public.pausas is 'Biblioteca de pausas activas. Reutilizables en múltiples programaciones (FR-008).';

-- ============================================================
-- Tabla: pausa_tipos_trabajo (N:M pausa ↔ tipo_trabajo)
-- Permite filtrar la biblioteca por tipo y sugerir pausas relevantes.
-- ============================================================
create table if not exists public.pausa_tipos_trabajo (
  pausa_id  uuid not null references public.pausas(id) on delete cascade,
  tipo_id   uuid not null references public.tipos_trabajo(id) on delete restrict,
  primary key (pausa_id, tipo_id)
);

create index if not exists idx_ptt_tipo on public.pausa_tipos_trabajo(tipo_id);

-- ============================================================
-- Storage bucket: pausas-media (imágenes y videos)
-- El bucket se crea idempotentemente. Las políticas de acceso van en 0005_rls.sql.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pausas-media',
  'pausas-media',
  true,  -- lectura pública (los archivos son contenido instructivo, no sensible)
  52428800, -- 50 MB
  array['image/jpeg','image/png','image/webp','image/svg+xml','video/mp4','video/webm']
)
on conflict (id) do nothing;
