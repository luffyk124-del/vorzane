-- Integration coverage for open player messaging, safety controls, and atomic market transfers.
\set ON_ERROR_STOP on
begin;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000101'),
  ('00000000-0000-4000-8000-000000000102'),
  ('00000000-0000-4000-8000-000000000103');

insert into public.player_profiles(user_id,display_name,avatar_id) values
  ('00000000-0000-4000-8000-000000000101','SellerOne','brand'),
  ('00000000-0000-4000-8000-000000000102','BuyerTwo','brand'),
  ('00000000-0000-4000-8000-000000000103','OutsiderThree','brand');

insert into public.friend_requests(requester_id,recipient_id,status)
values ('00000000-0000-4000-8000-000000000101','00000000-0000-4000-8000-000000000102','accepted');

insert into public.player_saves(user_id,game_state) values
  ('00000000-0000-4000-8000-000000000101',
   '{"hero":{"name":"SellerOne"},"gold":100,"inventory":[{"id":"armor-1","name":"درع الاختبار","slot":"درع","rarity":"rare","bonus":{"def":3},"price":100}],"equipped":{}}'::jsonb),
  ('00000000-0000-4000-8000-000000000102',
   '{"hero":{"name":"BuyerTwo"},"gold":500,"inventory":[],"equipped":{}}'::jsonb);

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select public.send_player_message('00000000-0000-4000-8000-000000000102','مرحبًا، هل تريد التبادل؟');
select public.send_player_message('00000000-0000-4000-8000-000000000103','مرحبًا، هذه رسالة للاعب غير صديق.');
do $test$
begin
  if (select count(*) from public.list_player_messages('00000000-0000-4000-8000-000000000103',null)) <> 1 then
    raise exception 'Expected direct messaging with a non-friend player';
  end if;
end $test$;

-- A recipient can block a stranger and prevent further contact.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select public.block_player('00000000-0000-4000-8000-000000000101');
do $test$
begin
  begin
    perform public.send_player_message('00000000-0000-4000-8000-000000000101','محاولة بعد الحظر');
    raise exception 'Expected blocked messaging to be rejected';
  exception when others then
    if sqlerrm = 'Expected blocked messaging to be rejected' then raise; end if;
  end;
end $test$;
select public.report_player('00000000-0000-4000-8000-000000000101','spam','رسائل غير مرغوبة');
do $test$
begin
  if (select count(*) from public.player_reports
      where reporter_id='00000000-0000-4000-8000-000000000103'
        and reported_id='00000000-0000-4000-8000-000000000101') <> 1 then
    raise exception 'Expected report to be stored for moderation';
  end if;
end $test$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select public.create_market_listing('armor-1',200);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select public.buy_market_listing((select id from public.player_market_listings where item_id='armor-1' and status='active'));

do $$
declare v_buyer jsonb; v_seller jsonb;
begin
  select game_state into v_buyer from public.player_saves where user_id='00000000-0000-4000-8000-000000000102';
  select game_state into v_seller from public.player_saves where user_id='00000000-0000-4000-8000-000000000101';
  if (v_buyer ->> 'gold')::int <> 300 then raise exception 'Buyer gold was not debited'; end if;
  if jsonb_array_length(v_buyer -> 'inventory') <> 1 then raise exception 'Buyer did not receive listed item'; end if;
  if (v_seller ->> 'gold')::int <> 300 then raise exception 'Seller did not receive sale proceeds'; end if;
  if jsonb_array_length(v_seller -> 'inventory') <> 0 then raise exception 'Seller inventory still contains sold item'; end if;
  if (select status from public.player_market_listings where item_id='armor-1') <> 'sold' then
    raise exception 'Listing was not marked sold';
  end if;
end $$;

rollback;
