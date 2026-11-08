-- Atomic command commit, optimistic concurrency, and replay protection.
-- Run only in the isolated CI database or a disposable local test database.

begin;

insert into auth.users (id)
values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b')
on conflict (id) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $ begin
  begin
    perform public.commit_player_command(
      '00000000-0000-0000-0000-00000000000a',
      '10000000-0000-4000-8000-000000000099',
      clock_timestamp(),
      '{"gold":999999}'::jsonb,
      '{"kind":"forbidden"}'::jsonb
    );
    raise exception 'COMMAND TEST FAIL: authenticated client invoked privileged RPC';
  exception when insufficient_privilege then
    null;
  end;
end $;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into public.player_saves (user_id, game_state)
values ('00000000-0000-0000-0000-00000000000a', '{"gold":10,"inventory":[]}')
on conflict (user_id) do update set game_state = excluded.game_state, updated_at = clock_timestamp();

do $$
declare
  v_expected timestamptz;
  v_after timestamptz;
  v_first jsonb;
  v_replay jsonb;
  v_conflict jsonb;
  v_saved jsonb;
begin
  select updated_at into v_expected
    from public.player_saves
   where user_id = '00000000-0000-0000-0000-00000000000a';

  v_first := public.commit_player_command(
    '00000000-0000-0000-0000-00000000000a',
    '10000000-0000-0000-0000-000000000001',
    v_expected,
    '{"gold":20,"inventory":[]}'::jsonb,
    '{"kind":"buyItem","gold":20}'::jsonb
  );
  if v_first->>'replayed' <> 'false' or v_first->>'conflict' is not null then
    raise exception 'COMMAND TEST FAIL: first command was not committed';
  end if;

  select updated_at, game_state into v_after, v_saved
    from public.player_saves
   where user_id = '00000000-0000-0000-0000-00000000000a';
  if v_saved->>'gold' <> '20' then
    raise exception 'COMMAND TEST FAIL: state was not updated';
  end if;

  v_replay := public.commit_player_command(
    '10000000-0000-0000-0000-000000000001',
    v_expected,
    '{"gold":999999,"inventory":[]}'::jsonb,
    '{"kind":"buyItem","gold":999999}'::jsonb
  );
  if v_replay->>'replayed' <> 'true'
     or v_replay#>>'{result,gold}' <> '20' then
    raise exception 'COMMAND TEST FAIL: replay did not return the original receipt';
  end if;

  select game_state into v_saved
    from public.player_saves
   where user_id = '00000000-0000-0000-0000-00000000000a';
  if v_saved->>'gold' <> '20' then
    raise exception 'COMMAND TEST FAIL: replay changed the saved state';
  end if;

  v_conflict := public.commit_player_command(
    '00000000-0000-0000-0000-00000000000a',
    '10000000-0000-0000-0000-000000000002',
    v_expected,
    '{"gold":30,"inventory":[]}'::jsonb,
    '{"kind":"buyItem","gold":30}'::jsonb
  );
  if v_conflict->>'conflict' <> 'true' then
    raise exception 'COMMAND TEST FAIL: stale version was not rejected';
  end if;

  -- The privileged RPC only accepts a target user ID from the trusted server role.
  begin
    perform public.commit_player_command(
      '00000000-0000-0000-0000-00000000000b',
      '10000000-0000-0000-0000-000000000003',
      v_after,
      '{"gold":999999}'::jsonb,
      '{"kind":"buyItem"}'::jsonb
    );
    raise exception 'COMMAND TEST FAIL: another player reached A save';
  exception when sqlstate 'P0002' then
    null;
  end;
end
$;

rollback;
