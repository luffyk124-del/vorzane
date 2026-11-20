\set ON_ERROR_STOP on
begin;

insert into auth.users(id)
values
  ('00000000-0000-4000-8000-000000000301'),
  ('00000000-0000-4000-8000-000000000302');

grant select, insert, update on public.player_saves to service_role;

-- Seed a trusted existing save before simulating authenticated requests.
insert into public.player_saves(user_id, game_state)
values (
  '00000000-0000-4000-8000-000000000301',
  '{
    "hero":{"name":"Original Hero"},
    "gold":500,
    "gems":50,
    "inventory":[{"id":"server-item","name":"Server Item","slot":"helmet","rarity":"rare","bonus":{"def":4},"price":120}],
    "equipped":{"helmet":null},
    "pets":["fairy-warden"],
    "activePet":"fairy-warden",
    "roaming":{"fragments":7,"fragmentsCollected":9,"gemRefillDate":"2026-11-15","gemRefillsUsed":1,"eventsCompleted":2}
  }'::jsonb
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000301',true);
select set_config('request.jwt.claim.role','authenticated',true);

-- A client may update ordinary profile progress, but forged economy fields are replaced.
update public.player_saves
set updated_at = '2099-01-01T00:00:00Z',
    game_state = game_state || '{
  "hero":{"name":"Updated Hero"},
  "gold":999999999,
  "gems":999999999,
  "inventory":[{"id":"forged-item","name":"Forged Item","slot":"weapon"}],
  "equipped":{"weapon":{"id":"forged-equipped"}},
  "pets":["forged-pet"],
  "activePet":"forged-pet",
  "roaming":{"fragments":999999,"fragmentsCollected":999999,"gemRefillDate":"2099-01-01","gemRefillsUsed":0,"eventsCompleted":8}
}'::jsonb
where user_id = '00000000-0000-4000-8000-000000000301';

do $test$
declare v_state jsonb;
begin
  select game_state into v_state
  from public.player_saves
  where user_id = '00000000-0000-4000-8000-000000000301';

  if v_state ->> 'gold' <> '500' or v_state ->> 'gems' <> '50' then
    raise exception 'Authenticated clients must not change gold or gems';
  end if;
  if v_state -> 'inventory' -> 0 ->> 'id' <> 'server-item' then
    raise exception 'Authenticated clients must not replace inventory items';
  end if;
  if v_state -> 'equipped' -> 'helmet' <> 'null'::jsonb
     or v_state -> 'pets' <> '["fairy-warden"]'::jsonb
     or v_state ->> 'activePet' <> 'fairy-warden' then
    raise exception 'Authenticated clients must not change equipped items or pets';
  end if;
  if v_state -> 'roaming' ->> 'fragments' <> '7'
     or v_state -> 'roaming' ->> 'fragmentsCollected' <> '9'
     or v_state -> 'roaming' ->> 'gemRefillDate' <> '2026-11-15'
     or v_state -> 'roaming' ->> 'gemRefillsUsed' <> '1' then
    raise exception 'Authenticated clients must not change exploration currency or refill limits';
  end if;
  if v_state -> 'roaming' ->> 'eventsCompleted' <> '8'
     or v_state -> 'hero' ->> 'name' <> 'Updated Hero' then
    raise exception 'Ordinary progress and character updates must remain writable';
  end if;
  if (select updated_at from public.player_saves
      where user_id = '00000000-0000-4000-8000-000000000301') >= '2099-01-01T00:00:00Z'::timestamptz then
    raise exception 'Authenticated clients must not control save timestamps';
  end if;
end $test$;

-- The active SQL role must remain authoritative even if the JWT role setting is absent.
select set_config('request.jwt.claim.role','',true);
update public.player_saves
set game_state = game_state || '{"gold":888888888,"gems":888888888,"inventory":[{"id":"missing-claim-forgery"}]}'::jsonb
where user_id = '00000000-0000-4000-8000-000000000301';

do $test$
declare v_state jsonb;
begin
  select game_state into v_state
  from public.player_saves
  where user_id = '00000000-0000-4000-8000-000000000301';

  if v_state ->> 'gold' <> '500'
     or v_state ->> 'gems' <> '50'
     or v_state -> 'inventory' -> 0 ->> 'id' <> 'server-item' then
    raise exception 'Authenticated SQL role must enforce economy protection without a JWT role setting';
  end if;
end $test$;

select set_config('request.jwt.claim.role','authenticated',true);

-- New accounts can still create a character, but cannot choose their starting economy.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000302',true);
insert into public.player_saves(user_id, game_state)
values (
  '00000000-0000-4000-8000-000000000302',
  '{
    "hero":{"name":"New Character"},
    "gold":999999999,
    "gems":999999999,
    "inventory":[{"id":"injected-item"}],
    "equipped":{"weapon":{"id":"injected-item"}},
    "pets":["injected-pet"],
    "activePet":"injected-pet",
    "roaming":{"fragments":999999,"fragmentsCollected":999999,"gemRefillDate":"2099-01-01","gemRefillsUsed":0}
  }'::jsonb
);

do $test$
declare v_state jsonb;
begin
  select game_state into v_state
  from public.player_saves
  where user_id = '00000000-0000-4000-8000-000000000302';

  if v_state ->> 'gold' <> '500' or v_state ->> 'gems' <> '50'
     or v_state -> 'inventory' <> '[]'::jsonb
     or v_state -> 'equipped' <> '{}'::jsonb
     or v_state -> 'pets' <> '[]'::jsonb
     or v_state -> 'activePet' <> 'null'::jsonb then
    raise exception 'New save economy must use canonical server defaults';
  end if;
  if v_state -> 'roaming' ->> 'fragments' <> '0'
     or v_state -> 'roaming' ->> 'fragmentsCollected' <> '0'
     or v_state -> 'roaming' ->> 'gemRefillsUsed' <> '0'
     or v_state -> 'hero' ->> 'name' <> 'New Character' then
    raise exception 'New character creation must remain available with canonical economy';
  end if;
end $test$;

reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

-- Trusted server commands are allowed to update economic fields.
update public.player_saves
set game_state = game_state || '{
  "gold":700,
  "gems":80,
  "inventory":[{"id":"trusted-item","name":"Trusted Item","slot":"weapon"}],
  "pets":["trusted-pet"],
  "activePet":"trusted-pet",
  "roaming":{"fragments":12,"fragmentsCollected":12,"gemRefillDate":"2026-11-15","gemRefillsUsed":2}
}'::jsonb
where user_id = '00000000-0000-4000-8000-000000000301';

reset role;

do $test$
declare v_state jsonb;
begin
  select game_state into v_state
  from public.player_saves
  where user_id = '00000000-0000-4000-8000-000000000301';

  if v_state ->> 'gold' <> '700' or v_state ->> 'gems' <> '80'
     or v_state -> 'inventory' -> 0 ->> 'id' <> 'trusted-item'
     or v_state -> 'pets' <> '["trusted-pet"]'::jsonb then
    raise exception 'Trusted server commands must retain their economic updates';
  end if;
  if has_table_privilege('authenticated', 'public.player_saves', 'DELETE') then
    raise exception 'Authenticated clients must not delete player saves';
  end if;
end $test$;

rollback;
