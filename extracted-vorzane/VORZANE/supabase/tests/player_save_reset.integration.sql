\set ON_ERROR_STOP on
do $test$
begin
  if exists (
    select 1 from auth.users u
    left join public.player_saves s on s.user_id = u.id
    where s.user_id is null
  ) then
    raise exception 'Every authentication account must receive a fresh player save';
  end if;

  if exists (
    select 1 from public.player_saves
    where game_state -> 'hero' is distinct from 'null'::jsonb
       or game_state ->> 'gold' <> '500'
       or game_state ->> 'gems' <> '50'
       or game_state -> 'inventory' <> '[]'::jsonb
       or game_state -> 'equipped' <> '{}'::jsonb
       or game_state ->> 'serverResetEpoch' is null
  ) then
    raise exception 'One or more player saves were not reset to the canonical fresh state';
  end if;

  if exists (select 1 from public.player_command_receipts) then
    raise exception 'Player command receipts must be cleared by the reset';
  end if;

  if not exists (
    select 1 from public.player_profiles
    where user_id='00000000-0000-4000-8000-000000000211'
      and display_name='ResetKeeper'
  ) then
    raise exception 'Player profile must be preserved by the reset';
  end if;

  if not exists (
    select 1 from public.friend_requests
    where requester_id='00000000-0000-4000-8000-000000000211'
      and recipient_id='00000000-0000-4000-8000-000000000212'
      and status='accepted'
  ) then
    raise exception 'Friend relationships must be preserved by the reset';
  end if;
end $test$;
