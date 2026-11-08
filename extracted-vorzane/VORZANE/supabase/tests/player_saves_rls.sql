-- Two-account RLS isolation test for public.player_saves.
-- Run against a TEST Supabase project or a local Postgres with auth schema. Never run on production.
-- Expects auth.users rows A and B to exist; uses fixed test UUIDs.

begin;

insert into auth.users (id, aud, role, email)
values
  ('00000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'rls-a@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'rls-b@test.local')
on conflict (id) do nothing;

-- Owner A writes own save.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.player_saves (user_id, game_state)
values ('00000000-0000-0000-0000-00000000000a', '{"gold":10}');

-- B must not read A's save.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ begin
  if (select count(*) from public.player_saves where user_id = '00000000-0000-0000-0000-00000000000a') <> 0 then
    raise exception 'RLS FAIL: B can read A save';
  end if;
end $$;

-- B must not update A's save.
update public.player_saves set game_state = '{"gold":999999}'
  where user_id = '00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if (select game_state->>'gold' from public.player_saves where user_id = '00000000-0000-0000-0000-00000000000a') <> '10' then
    raise exception 'RLS FAIL: B modified A save';
  end if;
end $$;

-- B must not delete A's save.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
delete from public.player_saves where user_id = '00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
do $$ begin
  if not exists (select 1 from public.player_saves where user_id = '00000000-0000-0000-0000-00000000000a') then
    raise exception 'RLS FAIL: B deleted A save';
  end if;
end $$;

-- Size limit: oversized payload must be rejected for new rows.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
do $$ begin
  begin
    insert into public.player_saves (user_id, game_state)
    values ('00000000-0000-0000-0000-00000000000b', jsonb_build_object('blob', repeat('x', 300000)));
    raise exception 'SIZE FAIL: oversized save accepted';
  exception when check_violation then
    null;
  end;
end $$;

rollback;
