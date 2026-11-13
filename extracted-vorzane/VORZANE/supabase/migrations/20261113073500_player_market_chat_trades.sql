-- Player-to-player messaging and a read-only player-market preview.
-- Trading stays disabled until inventory and currency mutations are server-authoritative.
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
  if not exists (select 1 from auth.users u where u.id = p_recipient_id) then
    raise exception 'Player not found';
  end if;
  -- Serialize concurrent sends from this account before applying the per-minute limit.
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  -- Coordinate sends with blocks. Recheck only after taking this shared pair lock,
  -- otherwise a block committed between an early check and this lock could be missed.
  perform pg_advisory_xact_lock(hashtextextended(
    least(v_user_id::text, p_recipient_id::text) || ':' || greatest(v_user_id::text, p_recipient_id::text), 0
  ));
  if exists (
    select 1 from public.player_blocks b
    where (b.blocker_id = v_user_id and b.blocked_id = p_recipient_id)
       or (b.blocker_id = p_recipient_id and b.blocked_id = v_user_id)
  ) then
    raise exception 'Messaging is unavailable for this player';
  end if;
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
  if not exists (select 1 from auth.users u where u.id = p_other_user_id) then
    raise exception 'Player not found';
  end if;
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
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid(); v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_other_user_id is null or p_other_user_id = v_user_id then
    raise exception 'Invalid conversation';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_other_user_id) then
    raise exception 'Player not found';
  end if;
  update public.player_messages set read_at = now()
  where sender_id = p_other_user_id and recipient_id = v_user_id and read_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$;

-- SECURITY DEFINER RPCs are callable by PUBLIC unless explicitly revoked.
revoke all on function public.send_player_message(uuid,text) from public, anon;
revoke all on function public.list_player_messages(uuid,timestamptz) from public, anon;
revoke all on function public.mark_player_messages_read(uuid) from public, anon;
grant execute on function public.send_player_message(uuid,text) to authenticated;
grant execute on function public.list_player_messages(uuid,timestamptz) to authenticated;
grant execute on function public.mark_player_messages_read(uuid) to authenticated;

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

-- No client-side listing mutation functions are created in this migration.
-- Real trading will be added only with a server-authoritative inventory ledger.

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


-- Open player messaging safety controls: block and report.
create table public.player_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint player_blocks_not_self check (blocker_id <> blocked_id)
);
alter table public.player_blocks enable row level security;
revoke all on public.player_blocks from anon, authenticated;
grant select on public.player_blocks to authenticated;
create policy player_blocks_owner_read on public.player_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

create table public.player_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam','harassment','inappropriate','other')),
  details text not null default '',
  created_at timestamptz not null default now(),
  constraint player_reports_not_self check (reporter_id <> reported_id),
  constraint player_reports_details_length check (char_length(details) <= 300),
  unique (reporter_id, reported_id)
);
alter table public.player_reports enable row level security;
revoke all on public.player_reports from anon, authenticated;

create or replace function public.block_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_player_id is null or p_player_id = v_user_id then raise exception 'Invalid player'; end if;
  if not exists (select 1 from auth.users u where u.id = p_player_id) then raise exception 'Player not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    least(v_user_id::text, p_player_id::text) || ':' || greatest(v_user_id::text, p_player_id::text), 0
  ));
  insert into public.player_blocks(blocker_id, blocked_id) values (v_user_id, p_player_id)
  on conflict (blocker_id, blocked_id) do nothing;
end;
$$;

create or replace function public.unblock_player(p_player_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_player_id is null or p_player_id = v_user_id then raise exception 'Invalid player'; end if;
  perform pg_advisory_xact_lock(hashtextextended(
    least(v_user_id::text, p_player_id::text) || ':' || greatest(v_user_id::text, p_player_id::text), 0
  ));
  delete from public.player_blocks where blocker_id = v_user_id and blocked_id = p_player_id;
end;
$;

create or replace function public.report_player(p_player_id uuid, p_reason text, p_details text default '')
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_user_id uuid := auth.uid();
  v_report_id uuid;
  v_details text := btrim(coalesce(p_details, ''));
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_player_id is null or p_player_id = v_user_id then raise exception 'Invalid player'; end if;
  if p_reason not in ('spam','harassment','inappropriate','other') then raise exception 'Invalid report reason'; end if;
  if char_length(v_details) > 300 then raise exception 'Report details are too long'; end if;
  if not exists (select 1 from auth.users u where u.id = p_player_id) then raise exception 'Player not found'; end if;
  -- Prevent concurrent submissions from bypassing the per-hour report limit.
  perform pg_advisory_xact_lock(hashtextextended('report:' || v_user_id::text, 0));
  if (select count(*) from public.player_reports r where r.reporter_id = v_user_id and r.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Report rate limit reached';
  end if;
  insert into public.player_reports(reporter_id, reported_id, reason, details)
  values (v_user_id, p_player_id, p_reason, v_details)
  on conflict (reporter_id, reported_id) do update
    set reason = excluded.reason, details = excluded.details, created_at = now()
  returning id into v_report_id;
  return v_report_id;
end;
$$;

revoke all on function public.block_player(uuid) from public, anon;
revoke all on function public.unblock_player(uuid) from public, anon;
revoke all on function public.report_player(uuid,text,text) from public, anon;
grant execute on function public.block_player(uuid) to authenticated;
grant execute on function public.unblock_player(uuid) to authenticated;
grant execute on function public.report_player(uuid,text,text) to authenticated;


-- Inbox index for every direct conversation, regardless of friendship state.
create or replace function public.list_my_conversations()
returns table(
  other_user_id uuid,
  display_name text,
  avatar_id text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return query
  with participant_messages as (
    select
      case when m.sender_id = v_user_id then m.recipient_id else m.sender_id end as other_id,
      m.body,
      m.created_at,
      m.id,
      (m.recipient_id = v_user_id and m.read_at is null) as unread
    from public.player_messages m
    where m.sender_id = v_user_id or m.recipient_id = v_user_id
  ),
  latest as (
    select distinct on (pm.other_id)
      pm.other_id, pm.body, pm.created_at
    from participant_messages pm
    order by pm.other_id, pm.created_at desc, pm.id desc
  ),
  unread as (
    select pm.other_id, count(*)::bigint as total
    from participant_messages pm
    where pm.unread
    group by pm.other_id
  )
  select
    l.other_id,
    coalesce(p.display_name, 'لاعب'),
    coalesce(p.avatar_id, 'brand'),
    l.body,
    l.created_at,
    coalesce(u.total, 0)
  from latest l
  left join public.player_profiles p on p.user_id = l.other_id
  left join unread u on u.other_id = l.other_id
  order by l.created_at desc
  limit 100;
end;
$$;
revoke all on function public.list_my_conversations() from public, anon;
grant execute on function public.list_my_conversations() to authenticated;
