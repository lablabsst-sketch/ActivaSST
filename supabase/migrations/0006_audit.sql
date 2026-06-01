-- 0006_audit.sql
-- Activa SST — Trigger que hace pausa_registros append-only (principio III).
-- Defensa en profundidad: aunque RLS ya bloquea UPDATE/DELETE para authenticated,
-- esto protege incluso al service_role contra mutaciones accidentales.

create or replace function public.block_pausa_registros_mutations()
returns trigger
language plpgsql
as $$
begin
  raise exception 'pausa_registros es append-only: % bloqueado', tg_op
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists trg_pausa_registros_no_update on public.pausa_registros;
create trigger trg_pausa_registros_no_update
  before update on public.pausa_registros
  for each row execute function public.block_pausa_registros_mutations();

drop trigger if exists trg_pausa_registros_no_delete on public.pausa_registros;
create trigger trg_pausa_registros_no_delete
  before delete on public.pausa_registros
  for each row execute function public.block_pausa_registros_mutations();

-- ============================================================
-- Trigger: server-side stamping de respondido_en.
-- Aunque RLS ya impide UPDATE, forzamos que el INSERT no pueda mentir sobre cuándo se respondió:
-- se sobrescribe siempre con now() del servidor. El cliente puede enviar el campo, pero será ignorado.
-- ============================================================
create or replace function public.stamp_respondido_en()
returns trigger
language plpgsql
as $$
begin
  new.respondido_en := now();
  return new;
end;
$$;

drop trigger if exists trg_pausa_registros_stamp on public.pausa_registros;
create trigger trg_pausa_registros_stamp
  before insert on public.pausa_registros
  for each row execute function public.stamp_respondido_en();
