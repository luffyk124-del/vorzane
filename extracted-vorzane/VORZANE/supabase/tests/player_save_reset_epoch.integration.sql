\set ON_ERROR_STOP on
begin;

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000201');

insert into public.player_saves(user_id, game_state)
values (
  '00000000-0000-4000-8000-000000000201',
  '{"hero":null,"gold":500,"serverResetEpoch":"reset-epoch-001"}'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);

do $test$
begin
  begin
    update public.player_saves
    set game_state = '{"hero":null,"gold":500}'::jsonb
    where user_id = '00000000-0000-4000-8000-000000000201';
    raise exception 'Expected a stale pre-reset save to be rejected';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'This player save was reset. Reload the game before saving.' then
      raise;
    end if;
  end;
end $test$;

update public.player_saves
set game_state = '{"hero":null,"gold":500,"serverResetEpoch":"reset-epoch-001"}'::jsonb
where user_id = '00000000-0000-4000-8000-000000000201';

do $test$
begin
  if has_table_privilege('authenticated','public.player_saves','DELETE') then
    raise exception 'Authenticated clients must not delete saves and bypass reset protection';
  end if;
  if (select game_state ->> 'serverResetEpoch' from public.player_saves
      where user_id = '00000000-0000-4000-8000-000000000201') <> 'reset-epoch-001' then
    raise exception 'A current client save should retain the server reset epoch';
  end if;
end $test$;

rollback;
