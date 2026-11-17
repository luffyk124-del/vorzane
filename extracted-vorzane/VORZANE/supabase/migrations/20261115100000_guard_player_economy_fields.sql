-- Authenticated clients may save ordinary progress, but economic ownership is server-owned.
-- The trigger preserves existing player balances and item ownership without rewriting player rows.
-- Trusted service-role commands remain the only path that can change these fields.

create or replace function public.guard_player_save_economy()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_claim_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  v_database_role text := current_user;
  v_old_roaming jsonb;
  v_new_roaming jsonb;
begin
  -- PostgREST sets both the active SQL role and JWT claim. Do not rely only on
  -- the claim setting: if it is absent, current_user must still enforce RLS rules.
  if v_claim_role = 'service_role'
     or (v_claim_role is null and v_database_role in ('service_role', 'postgres', 'supabase_admin')) then
    return new;
  end if;

  if v_claim_role = 'anon' or v_database_role = 'anon' then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if v_claim_role = 'authenticated' or v_database_role = 'authenticated' then
    if v_user_id is null or v_user_id is distinct from new.user_id then
      raise exception using errcode = '42501', message = 'Player save owner mismatch';
    end if;

    if jsonb_typeof(new.game_state) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Player state must be a JSON object';
    end if;

    if tg_op = 'INSERT' then
      -- Keep character creation and ordinary profile progress, but never accept
      -- client-selected starting currency, items, pets, or exploration resources.
      new.game_state := new.game_state || jsonb_build_object(
        'gold', 500,
        'gems', 50,
        'inventory', '[]'::jsonb,
        'equipped', '{}'::jsonb,
        'pets', '[]'::jsonb,
        'activePet', 'null'::jsonb
      );

      v_new_roaming := case
        when jsonb_typeof(new.game_state -> 'roaming') = 'object' then new.game_state -> 'roaming'
        else '{}'::jsonb
      end;
      v_new_roaming := v_new_roaming || jsonb_build_object(
        'fragments', 0,
        'fragmentsCollected', 0,
        'gemRefillDate', to_char(current_date, 'YYYY-MM-DD'),
        'gemRefillsUsed', 0
      );
      new.game_state := jsonb_set(new.game_state, '{roaming}', v_new_roaming, true);
    else
      if old.user_id is distinct from new.user_id then
        raise exception using errcode = '42501', message = 'Player save owner mismatch';
      end if;

      -- The database copy wins for every economic or ownership field.
      new.game_state := new.game_state || jsonb_build_object(
        'gold', coalesce(old.game_state -> 'gold', '500'::jsonb),
        'gems', coalesce(old.game_state -> 'gems', '50'::jsonb),
        'inventory', coalesce(old.game_state -> 'inventory', '[]'::jsonb),
        'equipped', coalesce(old.game_state -> 'equipped', '{}'::jsonb),
        'pets', coalesce(old.game_state -> 'pets', '[]'::jsonb),
        'activePet', coalesce(old.game_state -> 'activePet', 'null'::jsonb)
      );

      v_old_roaming := case
        when jsonb_typeof(old.game_state -> 'roaming') = 'object' then old.game_state -> 'roaming'
        else '{}'::jsonb
      end;
      v_new_roaming := case
        when jsonb_typeof(new.game_state -> 'roaming') = 'object' then new.game_state -> 'roaming'
        else '{}'::jsonb
      end;
      v_new_roaming := v_new_roaming || jsonb_build_object(
        'fragments', coalesce(v_old_roaming -> 'fragments', '0'::jsonb),
        'fragmentsCollected', coalesce(v_old_roaming -> 'fragmentsCollected', '0'::jsonb),
        'gemRefillDate', coalesce(v_old_roaming -> 'gemRefillDate', to_jsonb(to_char(current_date, 'YYYY-MM-DD'))),
        'gemRefillsUsed', coalesce(v_old_roaming -> 'gemRefillsUsed', '0'::jsonb)
      );
      new.game_state := jsonb_set(new.game_state, '{roaming}', v_new_roaming, true);
    end if;

    -- updated_at is also server-owned; clients cannot pin it in the future or
    -- manipulate optimistic command versions.
    new.updated_at := clock_timestamp();
  else
    raise exception using errcode = '42501', message = 'Untrusted player save role';
  end if;

  return new;
end;
$$;

drop trigger if exists player_saves_economy_guard on public.player_saves;
create trigger player_saves_economy_guard
before insert or update on public.player_saves
for each row execute function public.guard_player_save_economy();

-- Keep the reset guard and economic guard complementary: clients cannot delete
-- a save row to bypass either protection.
drop policy if exists players_delete_own_save on public.player_saves;
revoke delete on table public.player_saves from anon, authenticated;
revoke all on function public.guard_player_save_economy() from public, anon, authenticated;
