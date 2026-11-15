-- Keep pre-reset clients and offline snapshots from restoring wiped progress.
create or replace function public.guard_player_save_reset_epoch()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null
     and old.game_state ? 'serverResetEpoch'
     and new.game_state ->> 'serverResetEpoch'
         is distinct from old.game_state ->> 'serverResetEpoch' then
    raise exception using
      errcode = 'P0001',
      message = 'This player save was reset. Reload the game before saving.';
  end if;
  return new;
end;
$$;

drop trigger if exists player_saves_reset_epoch_guard on public.player_saves;
create trigger player_saves_reset_epoch_guard
before update on public.player_saves
for each row execute function public.guard_player_save_reset_epoch();

-- Prevent a client from deleting its row and re-inserting a pre-reset save.
drop policy if exists players_delete_own_save on public.player_saves;
revoke delete on table public.player_saves from anon, authenticated;
revoke all on function public.guard_player_save_reset_epoch() from public, anon, authenticated;
