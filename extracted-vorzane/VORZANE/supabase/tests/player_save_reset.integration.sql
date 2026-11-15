\set ON_ERROR_STOP on
do $test$
declare
  account_count integer;
  save_count integer;
begin
  select count(*) into account_count from auth.users;
  select count(*) into save_count from public.player_saves;

  if account_count <> 2 then
    raise exception 'Progress reset must preserve both Auth accounts; found %', account_count;
  end if;
  if save_count <> account_count then
    raise exception 'Every existing account must have exactly one fresh save; accounts %, saves %', account_count, save_count;
  end if;

  if not exists (
    select 1 from public.player_saves
    where user_id='00000000-0000-4000-8000-000000000211'
      and game_state ->> 'gold'='500'
      and game_state ->> 'gems'='50'
      and game_state -> 'hero'='null'::jsonb
      and game_state -> 'inventory'='[]'::jsonb
      and game_state -> 'pets'='[]'::jsonb
      and game_state -> 'equipped'='{}'::jsonb
      and coalesce(game_state ->> 'serverResetEpoch','') <> ''
  ) then
    raise exception 'Existing player progress was not replaced by the fresh baseline';
  end if;

  if exists (select 1 from public.player_command_receipts) then
    raise exception 'Stale command receipts remain after progress reset';
  end if;

  -- Authentication, player identity, and social relationships must survive.
  if not exists (
    select 1 from auth.users
    where id='00000000-0000-4000-8000-000000000211'
  ) or not exists (
    select 1 from auth.users
    where id='00000000-0000-4000-8000-000000000212'
  ) then
    raise exception 'Auth accounts must remain intact';
  end if;

  if not exists (
    select 1 from public.player_profiles
    where user_id='00000000-0000-4000-8000-000000000211'
      and display_name='ResetKeeper'
  ) then
    raise exception 'Player profile and display name must be preserved';
  end if;

  if not exists (
    select 1 from public.friend_requests
    where requester_id='00000000-0000-4000-8000-000000000211'
      and recipient_id='00000000-0000-4000-8000-000000000212'
      and status='accepted'
  ) then
    raise exception 'Friend relationship must be preserved';
  end if;

  if to_regclass('public.player_save_recovery') is not null then
    execute 'select exists (select 1 from public.player_save_recovery)' into account_count;
    if account_count <> 0 then
      raise exception 'Stale recovery snapshots must be cleared';
    end if;
  end if;

  if to_regclass('vorzane_internal.player_save_recovery_quotas') is not null then
    execute 'select exists (select 1 from vorzane_internal.player_save_recovery_quotas)' into account_count;
    if account_count <> 0 then
      raise exception 'Recovery quota counters must be cleared';
    end if;
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.player_saves') is null
     or to_regclass('public.player_profiles') is null
     or to_regclass('public.friend_requests') is null
     or to_regprocedure('auth.uid()') is null then
    raise exception 'Required Auth and social schema objects must remain available';
  end if;
end
$test$;
