-- Owner-scoped quarantine for untrusted local/legacy save snapshots.
-- Run only in isolated CI or a disposable local database.

begin;

insert into auth.users (id)
values
  ('00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000000c')
on conflict (id) do nothing;

set local role service_role;
insert into public.player_save_recovery (user_id, recovery_key, source, snapshot)
values (
  '00000000-0000-0000-0000-00000000000a',
  '10000000-0000-4000-8000-000000000001',
  'legacy',
  '{"gold":999999999,"hero":{"level":999},"inventory":[{"id":"untrusted"}]}'::jsonb
);

-- A recovery key is unique per owner; a duplicate cannot replace the first snapshot.
set local role service_role;
do $idempotency$
begin
  begin
    insert into public.player_save_recovery (user_id, recovery_key, source, snapshot)
    values (
      '00000000-0000-0000-0000-00000000000a',
      '10000000-0000-4000-8000-000000000001',
      'offline',
      '{"gold":1}'::jsonb
    );
    raise exception 'RECOVERY IDEMPOTENCY FAIL: duplicate recovery key accepted';
  exception when unique_violation then
    null;
  end;
end
$idempotency$;

-- Same owner can inspect the quarantined record.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', true);
do $owner$
begin
  if (select count(*) from public.player_save_recovery) <> 1 then
    raise exception 'RECOVERY RLS FAIL: owner cannot read own staged snapshot';
  end if;
end
$owner$;

-- Another account cannot read it.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', true);
do $other$
begin
  if (select count(*) from public.player_save_recovery) <> 0 then
    raise exception 'RECOVERY RLS FAIL: another account can read staged snapshot';
  end if;
end
$other$;

-- Client roles must not have write privileges on the quarantine table.
do $privileges$
begin
  if has_table_privilege('authenticated', 'public.player_save_recovery', 'INSERT')
     or has_table_privilege('authenticated', 'public.player_save_recovery', 'UPDATE')
     or has_table_privilege('authenticated', 'public.player_save_recovery', 'DELETE')
     or has_table_privilege('anon', 'public.player_save_recovery', 'SELECT') then
    raise exception 'RECOVERY PRIVILEGE FAIL: client role has forbidden access';
  end if;
end
$privileges$;

-- The database enforces a five-record lifetime quota even for service_role inserts.
set local role service_role;
do $quota$
declare
  i integer;
begin
  for i in 10..14 loop
    insert into public.player_save_recovery (user_id, recovery_key, source, snapshot)
    values (
      '00000000-0000-0000-0000-00000000000b',
      ('10000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid,
      'offline',
      jsonb_build_object('attempt', i)
    );
  end loop;

  begin
    insert into public.player_save_recovery (user_id, recovery_key, source, snapshot)
    values (
      '00000000-0000-0000-0000-00000000000b',
      '10000000-0000-4000-8000-000000000015',
      'offline',
      '{"attempt":15}'::jsonb
    );
    raise exception 'RECOVERY QUOTA FAIL: sixth recovery record was accepted';
  exception when check_violation then
    null;
  end;

end
$quota$;

-- Inspect the private counter as the migration owner, not as service_role.
reset role;
do $quota_counter$
begin
  if coalesce((select record_count from private.player_save_recovery_quotas
      where user_id = '00000000-0000-0000-0000-00000000000b'), 0) <> 5 then
    raise exception 'RECOVERY QUOTA FAIL: stored quota counter is incorrect';
  end if;
end
$quota_counter$;

-- Clients cannot inspect or manipulate the private quota counter or trigger function.
do $private$
begin
  if has_schema_privilege('authenticated', 'private', 'USAGE')
     or has_schema_privilege('service_role', 'private', 'USAGE')
     or has_table_privilege('service_role', 'private.player_save_recovery_quotas', 'INSERT')
     or has_table_privilege('service_role', 'private.player_save_recovery_quotas', 'UPDATE')
     or has_function_privilege('service_role', 'private.enforce_player_save_recovery_quota()', 'EXECUTE') then
    raise exception 'RECOVERY QUOTA PRIVILEGE FAIL: private quota internals are exposed';
  end if;
end
$private$;

-- The database also enforces the payload size limit for privileged callers.
set local role service_role;
do $size$
begin
  begin
    insert into public.player_save_recovery (user_id, recovery_key, source, snapshot)
    values (
      '00000000-0000-0000-0000-00000000000c',
      '10000000-0000-4000-8000-000000000002',
      'offline',
      jsonb_build_object('blob', repeat('x', 400000))
    );
    raise exception 'RECOVERY SIZE FAIL: oversized snapshot accepted';
  exception when check_violation then
    null;
  end;
end
$size$;

rollback;
