-- Player-to-player messaging, market listings, and two-party trades.
-- All inventory and currency mutations happen atomically in PostgreSQL.
-- Additive migration; no existing player save is rewritten during migration.

create table public.player_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint player_messages_not_self check (sender_id <> recipient_id),
  constraint player_messages_body_length check (char_length(btrim(body)) between 1 and 500)
);
create index player_messages_inbox_idx on public.player_messages(recipient_id, created_at desc);
create index player_messages_pair_idx on public.player_messages(sender_id, recipient_id, created_at desc);

alter table public.player_messages enable row level security;
revoke all on public.player_messages from anon, authenticated;
grant select on public.player_messages to authenticated;
create policy player_messages_participant_read on public.player_messages
  for select to authenticated using (sender_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create or replace function public.send_player_message(p_recipient_id uuid, p_body text)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then raise exception 'Invalid recipient'; end if;
  if char_length(v_body) not between 1 and 500 then raise exception 'Message must be 1-500 characters'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and least(f.requester_id, f.recipient_id) = least(v_user_id, p_recipient_id)
      and greatest(f.requester_id, f.recipient_id) = greatest(v_user_id, p_recipient_id)
  ) then raise exception 'Messaging is available between friends only'; end if;
  if (select count(*) from public.player_messages m
      where m.sender_id = v_user_id and m.created_at > now() - interval '1 minute') >= 10
  then raise exception 'Message rate limit reached'; end if;
  insert into public.player_messages(sender_id, recipient_id, body)
  values (v_user_id, p_recipient_id, v_body) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.list_player_messages(p_other_user_id uuid, p_before timestamptz default null)
returns table(id uuid, sender_id uuid, recipient_id uuid, body text, created_at timestamptz, read_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then raise exception 'Invalid conversation'; end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and least(f.requester_id, f.recipient_id) = least(v_user_id, p_other_user_id)
      and greatest(f.requester_id, f.recipient_id) = greatest(v_user_id, p_other_user_id)
  ) then raise exception 'Conversation not available'; end if;
  return query
    select m.id, m.sender_id, m.recipient_id, m.body, m.created_at, m.read_at
    from public.player_messages m
    where ((m.sender_id = v_user_id and m.recipient_id = p_other_user_id)
       or (m.sender_id = p_other_user_id and m.recipient_id = v_user_id))
      and (p_before is null or m.created_at < p_before)
    order by m.created_at desc limit 50;
end;
$$;

create or replace function public.mark_player_messages_read(p_other_user_id uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $
declare v_user_id uuid := auth.uid(); v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'Invalid conversation';
  end if;
  if not exists (
    select 1 from public.friend_requests f
    where f.status = 'accepted'
      and least(f.requester_id, f.recipient_id) = least(v_user_id, p_other_user_id)
      and greatest(f.requester_id, f.recipient_id) = greatest(v_user_id, p_other_user_id)
  ) then
    raise exception 'Conversation not available';
  end if;
  update public.player_messages set read_at = now()
  where sender_id = p_other_user_id and recipient_id = v_user_id and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create table public.player_market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  item_data jsonb not null,
  price bigint not null check (price between 1 and 1000000000),
  status text not null default 'active' check (status in ('active','sold','cancelled')),
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  buyer_id uuid references auth.users(id) on delete set null
);
create index player_market_active_idx on public.player_market_listings(created_at desc) where status = 'active';
create index player_market_seller_idx on public.player_market_listings(seller_id, created_at desc);

alter table public.player_market_listings enable row level security;
revoke all on public.player_market_listings from anon, authenticated;
grant select on public.player_market_listings to authenticated;
create policy player_market_read_active on public.player_market_listings
  for select to authenticated using (status = 'active' or seller_id = (select auth.uid()));

create or replace function public.create_market_listing(p_item_id text, p_price bigint)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_state jsonb;
  v_inventory jsonb;
  v_item jsonb;
  v_next jsonb;
  v_listing_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_item_id is null or char_length(p_item_id) not between 1 and 120 then raise exception 'Invalid item'; end if;
  if p_price is null or p_price < 1 or p_price > 1000000000 then raise exception 'Invalid listing price'; end if;
  select game_state into v_state from public.player_saves where user_id = v_user_id for update;
  if v_state is null then raise exception 'Player save not found'; end if;
  v_inventory := coalesce(v_state -> 'inventory', '[]'::jsonb);
  if jsonb_typeof(v_inventory) <> 'array' then raise exception 'Inventory data is invalid'; end if;
  select value into v_item from jsonb_array_elements(v_inventory) where value ->> 'id' = p_item_id limit 1;
  if v_item is null then raise exception 'Item is not in your inventory'; end if;
  if coalesce(v_item ->> 'slot','') not in ('درع','خوذة','قفازات','حذاء','قلادة','خاتم أول','خاتم ثانٍ','armor','shield','helmet','gloves','boots','necklace','ring') then
    raise exception 'Only non-weapon gear can be listed';
  end if;
  if exists (select 1 from jsonb_each(coalesce(v_state -> 'equipped','{}'::jsonb)) e where e.value ->> 'id' = p_item_id) then
    raise exception 'Unequip this item before listing it';
  end if;
  select coalesce(jsonb_agg(value), '[]'::jsonb) into v_next
    from jsonb_array_elements(v_inventory) where value ->> 'id' <> p_item_id;
  update public.player_saves set game_state = jsonb_set(v_state, '{inventory}', v_next), updated_at = now()
    where user_id = v_user_id;
  insert into public.player_market_listings(seller_id,item_id,item_data,price)
    values(v_user_id,p_item_id,v_item,p_price) returning id into v_listing_id;
  return v_listing_id;
end;
$$;

create or replace function public.cancel_market_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.player_market_listings;
  v_state jsonb;
  v_inventory jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_listing from public.player_market_listings
    where id = p_listing_id and seller_id = v_user_id and status = 'active' for update;
  if not found then raise exception 'Active listing not found'; end if;
  select game_state into v_state from public.player_saves where user_id = v_user_id for update;
  if v_state is null then raise exception 'Player save not found'; end if;
  v_inventory := coalesce(v_state -> 'inventory','[]'::jsonb);
  update public.player_saves set game_state = jsonb_set(v_state,'{inventory}',v_inventory || jsonb_build_array(v_listing.item_data)), updated_at = now()
    where user_id = v_user_id;
  update public.player_market_listings set status = 'cancelled' where id = p_listing_id;
end;
$$;

create or replace function public.buy_market_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_listing public.player_market_listings;
  v_buyer jsonb;
  v_seller jsonb;
  v_buyer_gold bigint;
  v_seller_gold bigint;
  v_buyer_inventory jsonb;
  v_seller_inventory jsonb;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_listing from public.player_market_listings where id = p_listing_id and status = 'active' for update;
  if not found then raise exception 'Listing is no longer available'; end if;
  if v_listing.seller_id = v_user_id then raise exception 'You cannot buy your own listing'; end if;
  perform user_id from public.player_saves where user_id in (v_user_id, v_listing.seller_id) order by user_id for update;
  select game_state into v_buyer from public.player_saves where user_id = v_user_id;
  select game_state into v_seller from public.player_saves where user_id = v_listing.seller_id;
  if v_buyer is null or v_seller is null then raise exception 'Player save not found'; end if;
  v_buyer_gold := coalesce((v_buyer ->> 'gold')::bigint,0);
  v_seller_gold := coalesce((v_seller ->> 'gold')::bigint,0);
  if v_buyer_gold < v_listing.price then raise exception 'Not enough gold'; end if;
  v_buyer_inventory := coalesce(v_buyer -> 'inventory','[]'::jsonb);
  v_seller_inventory := coalesce(v_seller -> 'inventory','[]'::jsonb);
  update public.player_saves set game_state =
    jsonb_set(jsonb_set(v_buyer,'{gold}',to_jsonb(v_buyer_gold-v_listing.price)),'{inventory}',v_buyer_inventory || jsonb_build_array(v_listing.item_data)),
    updated_at = now() where user_id = v_user_id;
  update public.player_saves set game_state =
    jsonb_set(v_seller,'{gold}',to_jsonb(v_seller_gold+v_listing.price)),
    updated_at = now() where user_id = v_listing.seller_id;
  update public.player_market_listings set status='sold', buyer_id=v_user_id, sold_at=now() where id=p_listing_id;
end;
$$;

revoke all on function public.send_player_message(uuid,text) from public, anon;
revoke all on function public.list_player_messages(uuid,timestamptz) from public, anon;
revoke all on function public.mark_player_messages_read(uuid) from public, anon;
revoke all on function public.create_market_listing(text,bigint) from public, anon;
revoke all on function public.cancel_market_listing(uuid) from public, anon;
revoke all on function public.buy_market_listing(uuid) from public, anon;
grant execute on function public.send_player_message(uuid,text) to authenticated;
grant execute on function public.list_player_messages(uuid,timestamptz) to authenticated;
grant execute on function public.mark_player_messages_read(uuid) to authenticated;
grant execute on function public.create_market_listing(text,bigint) to authenticated;
grant execute on function public.cancel_market_listing(uuid) to authenticated;
grant execute on function public.buy_market_listing(uuid) to authenticated;

create or replace function public.list_market_listings(p_limit integer default 30, p_before timestamptz default null)
returns table(listing_id uuid, seller_id uuid, seller_name text, item_data jsonb, price bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return query
    select l.id, l.seller_id, p.display_name, l.item_data, l.price, l.created_at
    from public.player_market_listings l
    join public.player_profiles p on p.user_id = l.seller_id
    where l.status = 'active'
      and l.seller_id <> v_user_id
      and (p_before is null or l.created_at < p_before)
      and coalesce(l.item_data ->> 'slot','') in ('درع','خوذة','قفازات','حذاء','قلادة','خاتم أول','خاتم ثانٍ','armor','shield','helmet','gloves','boots','necklace','ring')
    order by l.created_at desc
    limit greatest(1, least(coalesce(p_limit,30),50));
end;
$$;
revoke all on function public.list_market_listings(integer,timestamptz) from public, anon;
grant execute on function public.list_market_listings(integer,timestamptz) to authenticated;
