-- 0001_init.sql
-- Activa SST — esquema base: empresas, usuarios, tipos_trabajo
-- Aplicar en el editor SQL de Lovable Cloud.

-- ============================================================
-- Extensiones
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type rol_usuario as enum ('prevencionista', 'trabajador', 'empresa_admin');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tabla: empresas
-- Tenant raíz. Toda fila del sistema cuelga (directa o indirectamente) de aquí.
-- ============================================================
create table if not exists public.empresas (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null check (char_length(nombre) between 2 and 200),
  nit         text unique,
  tz          text not null default 'America/Bogota',
  created_at  timestamptz not null default now()
);

comment on table public.empresas is 'Tenant raíz. Cada usuario, pausa, programación y registro pertenece a una empresa.';

-- ============================================================
-- Tabla: usuarios
-- 1:1 con auth.users. id == auth.users.id (no FK explícita para no acoplar al schema auth).
-- ============================================================
create table if not exists public.usuarios (
  id          uuid primary key,
  empresa_id  uuid not null references public.empresas(id) on delete restrict,
  rol         rol_usuario not null,
  nombre      text not null check (char_length(nombre) between 2 and 200),
  documento   text,
  email       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_usuarios_empresa on public.usuarios(empresa_id);
create index if not exists idx_usuarios_rol on public.usuarios(empresa_id, rol) where activo;
create unique index if not exists uq_usuarios_documento_empresa
  on public.usuarios(empresa_id, documento) where documento is not null;

comment on table public.usuarios is 'Perfil de aplicación. id debe coincidir con auth.users.id (gestionado por trigger en Supabase Auth).';

-- ============================================================
-- Tabla: tipos_trabajo
-- Catálogo global (no por empresa). Cada empresa elige cuáles aplicar a cada trabajador.
-- ============================================================
create table if not exists public.tipos_trabajo (
  id      uuid primary key default gen_random_uuid(),
  slug    text not null unique,
  nombre  text not null
);

comment on table public.tipos_trabajo is 'Catálogo global de tipos de trabajo (oficina, operativo, etc.). Lectura pública.';

-- Seed inicial (idempotente).
insert into public.tipos_trabajo (slug, nombre) values
  ('oficina',           'Oficina / escritorio'),
  ('operativo',         'Operativo / planta'),
  ('conduccion',        'Conducción'),
  ('bodega',            'Bodega / almacén'),
  ('ventas',            'Ventas en campo'),
  ('atencion_cliente',  'Atención al cliente')
on conflict (slug) do nothing;

-- ============================================================
-- Tabla: usuario_tipos_trabajo (N:M trabajador ↔ tipo_trabajo)
-- Solo aplica a usuarios con rol = 'trabajador'. Se valida en RLS / app, no en CHECK
-- (porque CHECK no puede mirar otra tabla sin trigger).
-- ============================================================
create table if not exists public.usuario_tipos_trabajo (
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo_id     uuid not null references public.tipos_trabajo(id) on delete restrict,
  primary key (usuario_id, tipo_id)
);

create index if not exists idx_utt_tipo on public.usuario_tipos_trabajo(tipo_id);

-- ============================================================
-- Helper: empresa del usuario autenticado.
-- Se usa en políticas RLS de todas las tablas hijas para evitar joins repetidos.
-- SECURITY DEFINER para que las políticas que lo invocan no necesiten acceso directo a usuarios.
-- ============================================================
create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.usuarios where id = auth.uid()
$$;

revoke all on function public.current_empresa_id() from public;
grant execute on function public.current_empresa_id() to authenticated;

-- ============================================================
-- Helper: rol del usuario autenticado.
-- ============================================================
create or replace function public.current_rol()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid()
$$;

revoke all on function public.current_rol() from public;
grant execute on function public.current_rol() to authenticated;
