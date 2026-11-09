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
