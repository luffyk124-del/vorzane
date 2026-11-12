-- Atomic, per-player command commits with replay protection.
-- Additive only. Tested in isolated CI before production rollout.

create table public.player_command_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  command_id uuid not null,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id, command_id)
);

alter table public.player_command_receipts enable row level security;
revoke all on table public.player_command_receipts from anon, authenticated;
grant select on table public.player_command_receipts to service_role;

create or replace function public.commit_player_command(
  p_user_id uuid,
  p_command_id uuid,
  p_expected_updated_at timestamptz,
  p_game_state jsonb,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := p_user_id;
  v_current_updated_at timestamptz;
  v_next_updated_at timestamptz;
  v_previous_result jsonb;
begin
  if v_user_id is null or (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  if p_command_id is null
     or p_expected_updated_at is null
     or jsonb_typeof(p_game_state) is distinct from 'object'
     or jsonb_typeof(p_result) is distinct from 'object' then
    raise exception 'invalid_command_payload' using errcode = '22023';
  end if;

  -- Serialize commands for this save. The receipt check happens under the same
  -- row lock, so concurrent replays cannot apply the same command twice.
  select updated_at
    into v_current_updated_at
    from public.player_saves
   where user_id = v_user_id
   for update;

  if not found then
    raise exception 'save_not_found' using errcode = 'P0002';
  end if;

  select result
    into v_previous_result
    from public.player_command_receipts
   where user_id = v_user_id
     and command_id = p_command_id;

  if found then
    return jsonb_build_object(
      'replayed', true,
      'result', v_previous_result,
      'updatedAt', v_current_updated_at
    );
  end if;

  if v_current_updated_at <> p_expected_updated_at then
    return jsonb_build_object(
      'conflict', true,
      'updatedAt', v_current_updated_at
    );
  end if;

  update public.player_saves
     set game_state = p_game_state,
         updated_at = clock_timestamp()
   where user_id = v_user_id
   returning updated_at into v_next_updated_at;

  insert into public.player_command_receipts (user_id, command_id, result)
  values (v_user_id, p_command_id, p_result);

  return jsonb_build_object(
    'replayed', false,
    'result', p_result,
    'updatedAt', v_next_updated_at
  );
end;
$$;

revoke all on function public.commit_player_command(uuid, uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.commit_player_command(uuid, uuid, timestamptz, jsonb, jsonb) to service_role;
