-- Isolated PostgreSQL integration test for the VORZANE social migration.
-- This runs only against the disposable PostgreSQL service in GitHub Actions.

begin;

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');

set local role authenticated;

do $$
declare
  v_alice uuid := '00000000-0000-4000-8000-000000000001';
  v_bob uuid := '00000000-0000-4000-8000-000000000002';
  v_request uuid;
begin
  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  perform public.upsert_my_profile('Alice Test', 'brand');

  perform set_config('request.jwt.claim.sub', v_bob::text, true);
  perform public.upsert_my_profile('Bob Test', 'Mage');
  perform public.set_my_profile_searchable(false);

  perform set_config('request.jwt.claim.sub', v_alice::text, true);
  if exists (select 1 from public.search_players('Bob Test')) then
    raise exception 'Private profile leaked through search_players';
  end if;
  if exists (select 1 from public.player_profiles where user_id = v_bob) then
    raise exception 'Private profile leaked through direct RLS-protected select';
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
  v_request := public.send_friend_request(v_alice);

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
