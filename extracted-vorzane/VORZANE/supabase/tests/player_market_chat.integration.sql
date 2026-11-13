-- Integration coverage for friend-only messages and atomic market transfers.
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
do $$
begin
  if (select count(*) from public.list_player_messages('00000000-0000-4000-8000-000000000102',null)) <> 1 then
    raise exception 'Expected one private message in the friend conversation';
  end if;
end $$;

-- A non-friend must not be able to mark another player's messages as read.
insert into public.player_messages(sender_id,recipient_id,body)
values ('00000000-0000-4000-8000-000000000102','00000000-0000-4000-8000-000000000103','رسالة اختبار غير صديقة');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
do $$
begin
  begin
    perform public.mark_player_messages_read('00000000-0000-4000-8000-000000000102');
    raise exception 'Expected non-friend read receipt to be rejected';
  exception when others then
    if sqlerrm = 'Expected non-friend read receipt to be rejected' then raise; end if;
  end;
  if exists (
    select 1 from public.player_messages
    where sender_id='00000000-0000-4000-8000-000000000102'
      and recipient_id='00000000-0000-4000-8000-000000000103'
      and read_at is not null
  ) then raise exception 'Non-friend read receipt changed message state'; end if;
end $$;

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
