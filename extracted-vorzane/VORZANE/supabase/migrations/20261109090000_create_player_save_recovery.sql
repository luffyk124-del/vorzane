-- Quarantine untrusted device/legacy snapshots without changing the active player save.
-- Additive only. This migration must be tested in isolated CI before any production use.

create table public.player_save_recovery (
  recovery_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recovery_key uuid not null,
  source text not null check (source in ('legacy', 'offline')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint player_save_recovery_snapshot_size
    check (octet_length(snapshot::text) <= 393216),
  constraint player_save_recovery_resolution_consistency
    check ((status = 'pending' and resolved_at is null) or (status = 'resolved' and resolved_at is not null)),
  unique (user_id, recovery_key)
);

alter table public.player_save_recovery enable row level security;

-- Owners may inspect their quarantined recovery records, but only the server
-- may stage or resolve snapshots. No client insert/update/delete privilege.
revoke all on table public.player_save_recovery from anon, authenticated;
grant select on table public.player_save_recovery to authenticated;
grant select, insert, update on table public.player_save_recovery to service_role;

create policy players_select_own_save_recovery
  on public.player_save_recovery
  for select
  to authenticated
  using ((select auth.uid()) = user_id);


-- A lifetime per-owner quota prevents authenticated callers from filling storage
-- with arbitrarily many distinct recovery keys. The counter is private and can
-- only be changed by this trigger function.
create schema if not exists private;

create table vorzane_internal.player_save_recovery_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  record_count smallint not null check (record_count between 1 and 5)
);

revoke all on schema vorzane_internal from public, anon, authenticated, service_role;
revoke all on table vorzane_internal.player_save_recovery_quotas from public, anon, authenticated, service_role;

create or replace function vorzane_internal.enforce_player_save_recovery_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $quota$
declare
  v_record_count smallint;
begin
  -- ON CONFLICT serializes concurrent inserts on the same owner's counter row.
  -- This is AFTER INSERT, so duplicate-key attempts rejected by the unique index
  -- do not consume quota. Raising here rolls back the just-inserted recovery row.
  insert into vorzane_internal.player_save_recovery_quotas (user_id, record_count)
  values (new.user_id, 1)
  on conflict (user_id) do update
    set record_count = vorzane_internal.player_save_recovery_quotas.record_count + 1
    where vorzane_internal.player_save_recovery_quotas.record_count < 5
  returning record_count into v_record_count;

  if not found then
    raise exception 'Per-user recovery quota reached'
      using errcode = '23514',
            constraint = 'player_save_recovery_user_quota';
  end if;

  return new;
end
$quota$;

revoke all on function vorzane_internal.enforce_player_save_recovery_quota()
  from public, anon, authenticated, service_role;

create trigger player_save_recovery_enforce_quota
  after insert on public.player_save_recovery
  for each row
  execute function vorzane_internal.enforce_player_save_recovery_quota();
