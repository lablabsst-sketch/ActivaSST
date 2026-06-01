-- 0003_programaciones.sql
-- Activa SST — programaciones, fan-out a trabajadores, registros append-only.

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type estado_registro as enum ('pendiente', 'hecha', 'rechazada', 'vencida');
exception when duplicate_object then null; end $$;

-- ============================================================
-- Tabla: programaciones
-- Una programación = un disparo de UNA pausa a N trabajadores en un momento dado.
-- recurrencia_json reservado para US6 (P3); en MVP queda en null.
-- ============================================================
create table if not exists public.programaciones (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas(id) on delete restrict,
  pausa_id        uuid not null references public.pausas(id) on delete restrict,
  disparo_at      timestamptz not null,
  ventana_min     smallint not null default 30 check (ventana_min between 5 and 240),
  recurrencia_json jsonb,
  creador_id      uuid not null references public.usuarios(id) on delete restrict,
  procesada_at    timestamptz,  -- marcada por tick-scheduler cuando ya disparó el fan-out
  created_at      timestamptz not null default now()
);

-- Índice clave para el scheduler (busca disparos en una ventana corta).
create index if not exists idx_prog_disparo on public.programaciones(disparo_at) where procesada_at is null;
create index if not exists idx_prog_empresa on public.programaciones(empresa_id, disparo_at desc);

comment on table public.programaciones is 'Disparo programado de una pausa. tick-scheduler la procesa y crea pausa_registros.';

-- ============================================================
-- Tabla: programacion_trabajadores
-- Snapshot de a quién se le envió. Permite fan-out idempotente y reportes.
-- ============================================================
create table if not exists public.programacion_trabajadores (
  programacion_id uuid not null references public.programaciones(id) on delete cascade,
  trabajador_id   uuid not null references public.usuarios(id) on delete restrict,
  primary key (programacion_id, trabajador_id)
);

create index if not exists idx_pt_trabajador on public.programacion_trabajadores(trabajador_id);

-- ============================================================
-- Tabla: pausa_registros
-- APPEND-ONLY (principio III). El trigger en 0006_audit.sql bloquea UPDATE/DELETE.
-- ============================================================
create table if not exists public.pausa_registros (
  id              uuid primary key default gen_random_uuid(),
  programacion_id uuid not null references public.programaciones(id) on delete restrict,
  trabajador_id   uuid not null references public.usuarios(id) on delete restrict,
  estado          estado_registro not null,
  respondido_en   timestamptz not null default now(),
  motivo          text check (motivo is null or char_length(motivo) <= 500),
  response_uuid   uuid not null default gen_random_uuid(),
  user_agent      text,
  created_at      timestamptz not null default now()
);

-- Idempotencia: una respuesta única por (programación, trabajador). Si llega un retry
-- de la cola offline con el mismo response_uuid, el segundo INSERT falla por UNIQUE.
create unique index if not exists uq_pausa_registros_response on public.pausa_registros(response_uuid);
create unique index if not exists uq_pausa_registros_prog_trab on public.pausa_registros(programacion_id, trabajador_id);
create index if not exists idx_pr_trabajador on public.pausa_registros(trabajador_id, respondido_en desc);
create index if not exists idx_pr_empresa_estado on public.pausa_registros(programacion_id, estado);

comment on table public.pausa_registros is 'Registro auditable, append-only. Una sola respuesta por (programacion, trabajador).';
