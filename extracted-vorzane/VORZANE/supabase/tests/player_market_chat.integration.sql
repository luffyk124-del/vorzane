-- Integration coverage for open player messaging, inbox, safety controls, and disabled trading permissions.
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

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select public.send_player_message('00000000-0000-4000-8000-000000000102','مرحبًا، هل تريد التبادل؟');
select public.send_player_message('00000000-0000-4000-8000-000000000103','مرحبًا، هذه رسالة للاعب غير صديق.');
do $test$
begin
  if (select count(*) from public.list_player_messages('00000000-0000-4000-8000-000000000103',null)) <> 1 then
    raise exception 'Expected direct messaging with a non-friend player';
  end if;
end $test$;

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
do $test$
begin
  if (select count(*) from public.list_my_conversations()) <> 2 then
    raise exception 'Inbox should include conversations with friends and non-friends';
  end if;
  if not exists (
    select 1 from public.list_my_conversations()
    where other_user_id='00000000-0000-4000-8000-000000000103'
      and unread_count=0
      and last_message='مرحبًا، هذه رسالة للاعب غير صديق.'
  ) then
    raise exception 'Inbox should expose latest non-friend conversation';
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

do $test$
begin
  if has_function_privilege('authenticated','public.create_market_listing(text,bigint)','EXECUTE') then
    raise exception 'Authenticated clients must not create listings before server-authoritative inventory exists';
  end if;
  if has_function_privilege('authenticated','public.cancel_market_listing(uuid)','EXECUTE') then
    raise exception 'Authenticated clients must not cancel listings before server-authoritative inventory exists';
  end if;
  if has_function_privilege('authenticated','public.buy_market_listing(uuid)','EXECUTE') then
    raise exception 'Authenticated clients must not buy listings before server-authoritative inventory exists';
  end if;
  if has_table_privilege('authenticated','public.player_market_listings','INSERT')
     or has_table_privilege('authenticated','public.player_market_listings','UPDATE')
     or has_table_privilege('authenticated','public.player_market_listings','DELETE') then
    raise exception 'Authenticated clients must not mutate player market listings directly';
  end if;
end $test$;

rollback;
