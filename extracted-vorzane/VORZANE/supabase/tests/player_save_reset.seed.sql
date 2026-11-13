\set ON_ERROR_STOP on
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000211'),
  ('00000000-0000-4000-8000-000000000212')
on conflict (id) do nothing;

insert into public.player_saves(user_id,game_state) values
  ('00000000-0000-4000-8000-000000000211','{"hero":{"name":"OldHero"},"gold":98765,"gems":4321,"inventory":[{"id":"old"}],"serverResetEpoch":"old-epoch"}'::jsonb),
  ('00000000-0000-4000-8000-000000000212','{"hero":{"name":"OldHero2"},"gold":12345,"gems":6789,"inventory":[{"id":"old2"}]}'::jsonb)
on conflict (user_id) do update set game_state=excluded.game_state;

insert into public.player_command_receipts(user_id,command_id,result) values
  ('00000000-0000-4000-8000-000000000211','10000000-0000-4000-8000-000000000211','{"old":"receipt"}'::jsonb);

insert into public.player_profiles(user_id,display_name,avatar_id) values
  ('00000000-0000-4000-8000-000000000211','ResetKeeper','brand')
on conflict (user_id) do nothing;

insert into public.friend_requests(requester_id,recipient_id,status)
values ('00000000-0000-4000-8000-000000000211','00000000-0000-4000-8000-000000000212','accepted');
