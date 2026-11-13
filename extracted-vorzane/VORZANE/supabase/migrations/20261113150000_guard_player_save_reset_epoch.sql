-- Server-owned reset epochs invalidate snapshots from before an intentional reset.
create or replace function public.guard_player_save_reset_epoch()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $
declare
  v_user_id uuid := auth.uid();
  v_server_role text := nullif(current_setting('request.jwt.claim.role', true), '');
  v_old_epoch text;
begin
  -- Trusted server commands may initialize and rotate the epoch.
  if v_server_role = 'service_role' or v_user_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Never accept a client-chosen epoch on first save creation.
    new.game_state := jsonb_set(
      new.game_state,
      '{serverResetEpoch}',
      to_jsonb(gen_random_uuid()::text),
      true
    );
    return new;
  end if;

  v_old_epoch := old.game_state ->> 'serverResetEpoch';
  if v_old_epoch is null or v_old_epoch = '' then
    -- Backfill legacy saves with a server-generated epoch on their next write.
    new.game_state := jsonb_set(
      new.game_state,
      '{serverResetEpoch}',
      to_jsonb(gen_random_uuid()::text),
      true
    );
    return new;
  end if;

  if new.game_state ->> 'serverResetEpoch' is distinct from v_old_epoch then
    raise exception using
      errcode = 'P0001',
      message = 'This player save was reset. Reload the game before saving.';
  end if;

  return new;
end;
$;

drop trigger if exists player_saves_reset_epoch_guard on public.player_saves;
create trigger player_saves_reset_epoch_guard
before insert or update on public.player_saves
for each row execute function public.guard_player_save_reset_epoch();

-- Prevent a client from deleting its row and re-inserting a pre-reset save.
drop policy if exists players_delete_own_save on public.player_saves;
revoke delete on table public.player_saves from anon, authenticated;
revoke all on function public.guard_player_save_reset_epoch() from public, anon, authenticated;
