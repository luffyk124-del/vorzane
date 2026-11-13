\set ON_ERROR_STOP on
begin;

insert into auth.users(id)
values ('00000000-0000-4000-8000-000000000201');

create temporary table expected_reset_epoch (value text) on commit drop;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select set_config('request.jwt.claim.role','authenticated',true);

-- Even if a client supplies an epoch, the INSERT trigger replaces it.
insert into public.player_saves(user_id, game_state)
values (
  '00000000-0000-4000-8000-000000000201',
  '{"hero":null,"gold":500,"serverResetEpoch":"client-forged-epoch"}'::jsonb
);

do $test$
begin
  if not exists (
    select 1 from public.player_saves
    where user_id = '00000000-0000-4000-8000-000000000201'
      and nullif(game_state ->> 'serverResetEpoch','') is not null
      and game_state ->> 'serverResetEpoch' <> 'client-forged-epoch'
  ) then
    raise exception 'A client must not choose the initial reset epoch';
  end if;
end $test$;

insert into expected_reset_epoch(value)
select game_state ->> 'serverResetEpoch'
from public.player_saves
where user_id = '00000000-0000-4000-8000-000000000201';

select set_config('test.original_reset_epoch',(select value from expected_reset_epoch),true);

-- A current client may keep its epoch unchanged.
update public.player_saves
set game_state = jsonb_set(game_state, '{gold}', '450'::jsonb, true)
where user_id = '00000000-0000-4000-8000-000000000201';

-- Simulate the trusted reset command rotating the epoch.
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;
update public.player_saves
set game_state = jsonb_set(game_state, '{serverResetEpoch}', to_jsonb('server-reset-epoch-002'::text), true)
where user_id = '00000000-0000-4000-8000-000000000201';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000201',true);
select set_config('request.jwt.claim.role','authenticated',true);

-- A client holding the old epoch cannot restore its pre-reset snapshot.
do $test$
declare
  v_old_epoch text := current_setting('test.original_reset_epoch');
begin
  begin
    update public.player_saves
    set game_state = jsonb_set(game_state, '{serverResetEpoch}', to_jsonb(v_old_epoch), true)
    where user_id = '00000000-0000-4000-8000-000000000201';
    raise exception 'Expected a stale pre-reset save to be rejected';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'This player save was reset. Reload the game before saving.' then
      raise;
    end if;
  end;
end $test$;

-- A current client with the rotated epoch may save ordinary progress.
update public.player_saves
set game_state = jsonb_set(game_state, '{gold}', '400'::jsonb, true)
where user_id = '00000000-0000-4000-8000-000000000201';

do $test$
begin
  if has_table_privilege('authenticated','public.player_saves','DELETE') then
    raise exception 'Authenticated clients must not delete saves and bypass reset protection';
  end if;
  if (select game_state ->> 'serverResetEpoch' from public.player_saves
      where user_id = '00000000-0000-4000-8000-000000000201') <> 'server-reset-epoch-002' then
    raise exception 'The server reset epoch must remain stable for the current client';
  end if;
end $test$;

rollback;
