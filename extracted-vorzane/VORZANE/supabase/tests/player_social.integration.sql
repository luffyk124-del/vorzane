-- Isolated PostgreSQL integration test for VORZANE social and notification migrations.
-- This runs only against the disposable PostgreSQL service in GitHub Actions.

begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

insert into public.player_saves (user_id, game_state) values
  ('00000000-0000-4000-8000-000000000001', '{"hero":{"name":"Alice Hero","className":"Warrior","level":7,"stats":{"str":20,"def":18}},"characterStyle":{"gender":"female"},"equipped":{"سلاح":{"name":"Test Sword","rarity":"epic"}},"wins":9,"battles":12}'::jsonb),
  ('00000000-0000-4000-8000-000000000002', '{"hero":{"name":"Bob Hero","className":"Mage","level":11,"stats":{"str":30,"def":9}},"characterStyle":{"gender":"male"},"equipped":{"سلاح":{"name":"Arcane Staff","rarity":"legendary"}},"wins":22,"battles":30,"dimas":{"highestFloor":5},"roaming":{"eventsCompleted":14}}'::jsonb);

set local role authenticated;

do $$
declare
  v_alice uuid := '00000000-0000-4000-8000-000000000001';
  v_bob uuid := '00000000-0000-4000-8000-000000000002';
  v_request uuid;
  v_notification uuid;
begin
  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  perform public.upsert_my_profile('Alice Test', 'brand');

  perform set_config('request.jwt.claim.sub', v_bob::text, true);
  perform public.upsert_my_profile('Bob Test', 'Mage');
  perform public.set_my_profile_searchable(false);

  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  if not exists (select 1 from public.search_players('Bob Test') where user_id = v_bob) then
    raise exception 'Profile must remain searchable even when legacy toggle is set false';
  end if;
  if not exists (select 1 from public.player_profiles where user_id = v_bob) then
    raise exception 'All authenticated players must be able to read public profile rows';
  end if;
  if public.get_public_player_profile(v_bob) ->> 'hero_name' <> 'Bob Hero'
     or public.get_public_player_profile(v_bob) #>> '{equipped,سلاح,name}' <> 'Arcane Staff'
     or public.get_public_player_profile(v_bob) ->> 'level' <> '11' then
    raise exception 'Public player profile did not return sanitized hero details and equipped gear';
  end if;

  perform set_config('request.jwt.claim.sub', v_bob::text, true);
  perform public.set_my_profile_searchable(true);
  if not exists (
    select 1 from public.search_players('Alice Test')
    where display_name = 'Alice Test' and friend_state = 'none'
  ) then
    raise exception 'Searchable profile was not returned by player search';
  end if;
  begin
    perform * from public.search_players('%%%');
    raise exception 'Search accepted wildcard-only input';
  exception
    when others then
      if sqlerrm = 'Search accepted wildcard-only input' then
        raise;
      elsif sqlerrm <> 'Search query contains unsupported characters' then
        raise;
      end if;
  end;
  if exists (select 1 from public.search_players('___')) then
    raise exception 'Underscores were treated as search wildcards';
  end if;

  -- Bob sends a request to Alice. Only Alice should receive the new-request notification.
  v_request := public.send_friend_request(v_alice);
  if exists (select 1 from public.list_my_notifications()) then
    raise exception 'Requester received their own friend-request notification';
  end if;
  if exists (
    select 1 from public.player_notifications
    where recipient_id = v_bob and friend_request_id = v_request
  ) then
    raise exception 'Notification recipient was assigned incorrectly';
  end if;

  -- Only the recipient may respond to a request.
  begin
    perform public.respond_friend_request(v_request, true);
    raise exception 'Requester unexpectedly responded to their own request';
  exception
    when others then
      if sqlerrm = 'Requester unexpectedly responded to their own request' then
        raise;
      end if;
  end;

  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  if not exists (
    select 1 from public.list_incoming_friend_requests()
    where request_id = v_request and requester_id = v_bob
  ) then
    raise exception 'Recipient cannot see the incoming request';
  end if;
  if not exists (
    select 1 from public.list_my_notifications()
    where notification_type = 'friend_request'
      and actor_name = 'Bob Test'
      and friend_request_id = v_request
      and read_at is null
  ) then
    raise exception 'Recipient did not receive the friend-request notification';
  end if;

  select notification_id into v_notification
  from public.list_my_notifications()
  where notification_type = 'friend_request' and friend_request_id = v_request;
  perform public.mark_notification_read(v_notification);
  if exists (
    select 1 from public.list_my_notifications()
    where notification_id = v_notification and read_at is null
  ) then
    raise exception 'Recipient notification was not marked as read';
  end if;

  -- A different player cannot mark Alice's notification as read.
  perform set_config('request.jwt.claim.sub', v_bob::text, true);
  begin
    perform public.mark_notification_read(v_notification);
    raise exception 'Non-recipient marked another player notification as read';
  exception
    when others then
      if sqlerrm = 'Non-recipient marked another player notification as read' then
        raise;
      elsif sqlerrm <> 'Notification not found' then
        raise;
      end if;
  end;

  -- Alice accepts; Bob receives an acceptance notification.
  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  perform public.respond_friend_request(v_request, true);
  if not exists (
    select 1 from public.list_my_friends() where user_id = v_bob
  ) then
    raise exception 'Accepted friend is missing from recipient friend list';
  end if;

  perform set_config('request.jwt.claim.sub', v_bob::text, true);
  if not exists (
    select 1 from public.list_my_friends() where user_id = v_alice
  ) then
    raise exception 'Accepted friend is missing from requester friend list';
  end if;
  if not exists (
    select 1 from public.list_my_notifications()
    where notification_type = 'friend_request_accepted'
      and actor_name = 'Alice Test'
      and friend_request_id = v_request
      and read_at is null
  ) then
    raise exception 'Requester did not receive the acceptance notification';
  end if;
  perform public.mark_all_notifications_read();
  if exists (select 1 from public.list_my_notifications() where read_at is null) then
    raise exception 'mark_all_notifications_read left unread notifications';
  end if;

  perform public.remove_friend(v_alice);
  if exists (select 1 from public.list_my_friends()) then
    raise exception 'Removed friendship still appears in friend list';
  end if;

  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  if exists (select 1 from public.list_my_friends()) then
    raise exception 'Removed friendship still appears for the other participant';
  end if;
end;
$$;

rollback;
