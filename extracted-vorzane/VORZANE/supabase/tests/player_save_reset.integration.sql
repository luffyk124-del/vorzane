\set ON_ERROR_STOP on
do $test$
begin
  -- Every player account and all player-owned records must be gone.
  if exists (select 1 from auth.users)
     or exists (select 1 from auth.identities)
     or exists (select 1 from auth.sessions)
     or exists (select 1 from auth.refresh_tokens)
     or exists (select 1 from public.player_saves)
     or exists (select 1 from public.player_profiles)
     or exists (select 1 from public.friend_requests)
     or exists (select 1 from public.player_notifications)
     or exists (select 1 from public.player_command_receipts) then
    raise exception 'Full reset left account, session, social, or player data behind';
  end if;

  -- Snapshots must retain representative pre-reset data for the recovery window.
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

  -- Backups are private; project schema and authentication service remain.
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
     or to_regclass('storage.buckets') is null then
    raise exception 'The reset must preserve required schema objects';
  end if;
end
$test$;
