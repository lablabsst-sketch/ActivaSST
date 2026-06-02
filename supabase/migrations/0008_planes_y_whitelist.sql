-- 0008_planes_y_whitelist.sql
-- Activa SST — Planes por cantidad + whitelist de login + estado pendiente
-- Encapsula FR-019..FR-023 (US7, US8 y refinamiento de US5).
-- Aplicar en el editor SQL de Lovable Cloud.

-- ============================================================
-- Enum: estado_usuario
-- pendiente: pre-registrado por el prevencionista, aún no ha completado primer login.
-- activo:    operativo, cuenta cupo del plan, puede recibir pausas.
-- inactivo:  desactivado por prevencionista/admin; bloqueado para login y NO cuenta cupo.
-- ============================================================
do $$ begin
  create type estado_usuario as enum ('pendiente', 'activo', 'inactivo');
exception when duplicate_object then null; end $$;

-- ============================================================
-- usuarios.estado (nuevo) + backfill desde activo
-- Se mantiene `activo` para compatibilidad con índices existentes; queda derivado
-- del estado vía trigger más abajo.
-- ============================================================
alter table public.usuarios
  add column if not exists estado estado_usuario not null default 'activo';

update public.usuarios
   set estado = (case when activo then 'activo' else 'inactivo' end)::estado_usuario
 where (activo and estado <> 'activo') or (not activo and estado <> 'inactivo');

create index if not exists idx_usuarios_estado_empresa
  on public.usuarios(empresa_id, estado);

-- Trigger: sincroniza activo ↔ estado para no romper código existente.
create or replace function public.sync_usuario_activo()
returns trigger
language plpgsql
as $$
begin
  new.activo := new.estado in ('pendiente', 'activo');
  return new;
end $$;

drop trigger if exists trg_sync_usuario_activo on public.usuarios;
create trigger trg_sync_usuario_activo
  before insert or update of estado on public.usuarios
  for each row execute function public.sync_usuario_activo();

-- ============================================================
-- Whitelist obligatorio de email
-- ============================================================
alter table public.usuarios
  alter column email set not null;

-- Email único dentro de la empresa (no global: dos empresas distintas pueden tener
-- el mismo email teóricamente, aunque en la práctica un email = una persona).
create unique index if not exists uq_usuarios_email_empresa
  on public.usuarios(empresa_id, lower(email));

-- Email único global cuando estado es pendiente|activo (para que el whitelist sea unívoco).
create unique index if not exists uq_usuarios_email_global_activo
  on public.usuarios(lower(email))
  where estado in ('pendiente', 'activo');

-- ============================================================
-- Tabla: planes
-- Estructura espejo de SSTLink. precio_mes_cop = 0 para gratis y para enterprise (precio a convenir).
-- ============================================================
do $$ begin
  create type plan_slug as enum ('gratis', 'starter', 'growth', 'business', 'enterprise');
exception when duplicate_object then null; end $$;

create table if not exists public.planes (
  id                uuid primary key default gen_random_uuid(),
  slug              plan_slug not null unique,
  nombre            text not null,
  max_trabajadores  int  not null check (max_trabajadores > 0),
  precio_mes_cop    int  not null default 0 check (precio_mes_cop >= 0),
  activo            boolean not null default true,
  created_at        timestamptz not null default now()
);

comment on table public.planes is 'Catálogo de planes comerciales. max_trabajadores = cupo simultáneo (estados pendiente+activo).';

-- Seed inicial (idempotente). Cifras orientativas alineadas con SSTLink; ajustables.
insert into public.planes (slug, nombre, max_trabajadores, precio_mes_cop) values
  ('gratis',     'Gratis',      5,        0),
  ('starter',    'Starter',     25,   49000),
  ('growth',     'Growth',     100,  149000),
  ('business',   'Business',   500,  449000),
  ('enterprise', 'Enterprise', 100000, 0)  -- precio a convenir, cupo "ilimitado" práctico
on conflict (slug) do nothing;

-- ============================================================
-- empresas.plan_id
-- ============================================================
alter table public.empresas
  add column if not exists plan_id uuid references public.planes(id) on delete restrict;

-- Backfill: toda empresa sin plan queda en 'gratis'.
update public.empresas e
  set plan_id = p.id
  from public.planes p
  where p.slug = 'gratis' and e.plan_id is null;

alter table public.empresas
  alter column plan_id set not null;

-- Logo para el reporte PDF (FR-024). Opcional.
alter table public.empresas
  add column if not exists logo_url text;

-- ============================================================
-- Trigger: límite de cupo por plan
-- Se aplica BEFORE INSERT y BEFORE UPDATE OF estado, contando filas existentes
-- con estado in ('pendiente','activo') EXCLUYENDO la fila bajo modificación.
-- Solo aplica a rol='trabajador' (prevencionistas y empresa_admin no consumen cupo).
-- ============================================================
create or replace function public.check_plan_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_plan_nombre text;
  v_actual int;
begin
  -- Solo cuenta cupo si el resultado deja al usuario en estado consumidor y es trabajador.
  if new.rol <> 'trabajador' then
    return new;
  end if;
  if new.estado not in ('pendiente', 'activo') then
    return new;
  end if;

  -- Si es UPDATE y ya estaba consumiendo cupo, no incrementa.
  if tg_op = 'UPDATE'
     and old.rol = 'trabajador'
     and old.estado in ('pendiente', 'activo')
     and old.empresa_id = new.empresa_id then
    return new;
  end if;

  select p.max_trabajadores, p.nombre
    into v_limit, v_plan_nombre
  from public.empresas e
  join public.planes  p on p.id = e.plan_id
  where e.id = new.empresa_id;

  if v_limit is null then
    raise exception 'Empresa % no tiene plan asignado', new.empresa_id
      using errcode = 'check_violation';
  end if;

  select count(*) into v_actual
    from public.usuarios
   where empresa_id = new.empresa_id
     and rol = 'trabajador'
     and estado in ('pendiente', 'activo')
     and id <> new.id;

  if v_actual + 1 > v_limit then
    raise exception 'Has alcanzado el límite del plan % (% trabajadores). Actualiza tu plan para sumar más usuarios.',
      v_plan_nombre, v_limit
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_check_plan_limit on public.usuarios;
create trigger trg_check_plan_limit
  before insert or update of estado, rol, empresa_id on public.usuarios
  for each row execute function public.check_plan_limit();

-- ============================================================
-- Whitelist de auth: rechaza signup/login si el email no fue pre-registrado.
-- ============================================================
create or replace function public.email_is_whitelisted(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.usuarios
    where lower(email) = lower(p_email)
      and estado in ('pendiente', 'activo')
  );
$$;

revoke all on function public.email_is_whitelisted(text) from public;
grant execute on function public.email_is_whitelisted(text) to anon, authenticated;

-- Trigger en auth.users que bloquea el INSERT si no está en whitelist.
-- Si Lovable Cloud no permite triggers en auth.users, esta sección puede fallar:
-- en ese caso, mover la validación a un Edge Function "before-signup" o a un
-- check en el frontend antes de invocar signInWithOtp.
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    return new; -- usuarios sin email (raros) no aplican
  end if;
  if not public.email_is_whitelisted(new.email) then
    raise exception 'Email no autorizado para iniciar sesión en Activa SST'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

do $$ begin
  drop trigger if exists trg_enforce_email_whitelist on auth.users;
  create trigger trg_enforce_email_whitelist
    before insert on auth.users
    for each row execute function public.enforce_email_whitelist();
exception when insufficient_privilege then
  raise notice 'No se pudo crear trigger en auth.users (permisos). Aplicar whitelist desde Edge Function/Auth Hook.';
end $$;

-- ============================================================
-- RLS para planes: lectura pública para authenticated; escritura solo service_role.
-- ============================================================
alter table public.planes enable row level security;

drop policy if exists planes_read on public.planes;
create policy planes_read
  on public.planes for select
  to authenticated
  using (true);

-- No CREATE policy para insert/update/delete → bloqueado para todos los roles no service.

-- ============================================================
-- RLS adicional: empresas.plan_id lectura ya cubierta por políticas previas.
-- Si el prevencionista cambia de plan: solo service_role o empresa_admin pueden update.
-- (Las políticas de empresas vienen de 0005_rls.sql; este archivo asume que ya restringen).
-- ============================================================
