\set ON_ERROR_STOP on
do $test$
declare
  has_rows boolean := false;
begin
  -- Every account, session, and player-owned record must be gone.
  if exists (select 1 from auth.users)
     or exists (select 1 from public.player_saves)
     or exists (select 1 from public.player_profiles)
     or exists (select 1 from public.friend_requests)
     or exists (select 1 from public.player_notifications)
     or exists (select 1 from public.player_command_receipts) then
    raise exception 'Full reset left account, social, or player data behind';
  end if;

  -- Optional managed Auth tables are present in production but not the small CI fixture.
  if to_regclass('auth.identities') is not null then
    execute 'select exists (select 1 from auth.identities)' into has_rows;
    if has_rows then raise exception 'Auth identities remain after full reset'; end if;
  end if;
  if to_regclass('auth.sessions') is not null then
    execute 'select exists (select 1 from auth.sessions)' into has_rows;
    if has_rows then raise exception 'Auth sessions remain after full reset'; end if;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'select exists (select 1 from auth.refresh_tokens)' into has_rows;
    if has_rows then raise exception 'Auth refresh tokens remain after full reset'; end if;
  end if;

  if to_regclass('public.player_save_recovery') is not null then
    execute 'select exists (select 1 from public.player_save_recovery)' into has_rows;
    if has_rows then raise exception 'Player recovery snapshots remain after full reset'; end if;
  end if;
  if to_regclass('vorzane_internal.player_save_recovery_quotas') is not null then
    execute 'select exists (select 1 from vorzane_internal.player_save_recovery_quotas)' into has_rows;
    if has_rows then raise exception 'Player recovery quota records remain after full reset'; end if;
  end if;

  -- Snapshots retain representative pre-reset records during the recovery window.
  if not exists (
    select 1 from private.auth_users_pre_reset_20261113
    where id='00000000-0000-4000-8000-000000000211'
  ) or not exists (
    select 1 from private.auth_users_pre_reset_20261113
    where id='00000000-0000-4000-8000-000000000212'
  ) then
    raise exception 'The account-ID snapshot must preserve the original test accounts';
  end if;

  if not exists (
    select 1 from private.player_saves_pre_reset_20261113
    where user_id='00000000-0000-4000-8000-000000000211'
      and game_state ->> 'gold' = '98765'
      and game_state ->> 'serverResetEpoch' = 'old-epoch'
  ) then
    raise exception 'The player-save snapshot did not preserve original progress';
  end if;

  if not exists (
    select 1 from private.player_profiles_pre_reset_20261113
    where user_id='00000000-0000-4000-8000-000000000211'
      and display_name='ResetKeeper'
  ) then
    raise exception 'The player-profile snapshot did not preserve the original profile';
  end if;

  if not exists (
    select 1 from private.friend_requests_pre_reset_20261113
    where requester_id='00000000-0000-4000-8000-000000000211'
      and recipient_id='00000000-0000-4000-8000-000000000212'
      and status='accepted'
  ) then
    raise exception 'The friend-request snapshot did not preserve the original relationship';
  end if;

  if not exists (
    select 1 from private.player_command_receipts_pre_reset_20261113
    where user_id='00000000-0000-4000-8000-000000000211'
      and command_id='10000000-0000-4000-8000-000000000211'
  ) then
    raise exception 'The command-receipt snapshot did not preserve the original receipt';
  end if;

  -- Backups are private; project schema and authentication entry point remain.
  if has_table_privilege('anon','private.auth_users_pre_reset_20261113','SELECT')
     or has_table_privilege('authenticated','private.auth_users_pre_reset_20261113','SELECT')
     or has_table_privilege('anon','private.player_saves_pre_reset_20261113','SELECT')
     or has_table_privilege('authenticated','private.player_saves_pre_reset_20261113','SELECT') then
    raise exception 'Private reset snapshots are readable by client roles';
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.player_saves') is null
     or to_regclass('public.player_profiles') is null
     or to_regclass('public.friend_requests') is null
     or to_regclass('public.player_notifications') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception 'The reset must preserve required database/auth schema objects';
  end if;
end
$test$;
