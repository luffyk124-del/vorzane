create table public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  game_state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint player_saves_game_state_object check (jsonb_typeof(game_state) = 'object')
);

alter table public.player_saves enable row level security;

revoke all on table public.player_saves from anon;
grant select, insert, update, delete on table public.player_saves to authenticated;

create policy players_select_own_save
  on public.player_saves
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy players_insert_own_save
  on public.player_saves
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy players_update_own_save
  on public.player_saves
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy players_delete_own_save
  on public.player_saves
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
