-- 0004_push_y_consent.sql
-- Activa SST — suscripciones push (web + futuro fcm) y consentimientos Habeas Data.

-- ============================================================
-- Enum: canal de notificación
-- 'web' = Web Push API. 'fcm' reservado para wrap con Capacitor (post-MVP).
-- ============================================================
do $$ begin
  create type push_tipo as enum ('web', 'fcm');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tabla: push_subscriptions
-- En MVP solo se inserta tipo='web'. El esquema deja todo listo para FCM.
-- ============================================================
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        push_tipo not null default 'web',
  endpoint    text,     -- Web Push: URL del servicio. FCM: null.
  p256dh      text,     -- Web Push only.
  auth        text,     -- Web Push only.
  fcm_token   text,     -- FCM only.
  user_agent  text,
  created_at  timestamptz not null default now(),
  constraint chk_push_payload check (
    (tipo = 'web' and endpoint is not null and p256dh is not null and auth is not null)
    or
    (tipo = 'fcm' and fcm_token is not null)
  )
);

-- Endpoint debe ser único globalmente (es lo que identifica un device/browser ante el push service).
create unique index if not exists uq_push_endpoint on public.push_subscriptions(endpoint) where endpoint is not null;
create unique index if not exists uq_push_fcm on public.push_subscriptions(fcm_token) where fcm_token is not null;
create index if not exists idx_push_usuario on public.push_subscriptions(usuario_id);

comment on table public.push_subscriptions is 'Suscripciones push por dispositivo. Un usuario puede tener varias (móvil + escritorio).';

-- ============================================================
-- Tabla: consentimientos (Ley 1581/2012 — Habeas Data)
-- Append-only en la práctica: nunca se borran. revocado_at se setea con UPDATE limitado
-- a una sola vez (validado en RLS / app).
-- ============================================================
create table if not exists public.consentimientos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references public.usuarios(id) on delete cascade,
  version_aviso   text not null,  -- ej. 'v1.0-2026-06-01'
  aceptado_at     timestamptz not null default now(),
  revocado_at     timestamptz,
  user_agent      text
);

create index if not exists idx_consent_usuario on public.consentimientos(usuario_id, aceptado_at desc);

comment on table public.consentimientos is 'Trazabilidad del consentimiento Habeas Data por versión de aviso de privacidad.';
