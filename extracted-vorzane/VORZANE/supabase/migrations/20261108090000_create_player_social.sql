-- Additive social foundation for VORZANE.
-- This migration does not modify player_saves or existing auth users.
-- Apply only after reviewing and testing against a dedicated Supabase project.

create table public.player_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_id text not null default 'brand',
  is_searchable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_profiles_display_name_length check (char_length(btrim(display_name)) between 3 and 24),
  constraint player_profiles_display_name_chars check (btrim(display_name) ~ '^[[:alnum:]_ -]{3,24}$'),
  constraint player_profiles_avatar_check check (avatar_id in ('brand', 'Warrior', 'Mage', 'Assassin', 'Archer'))
);

create unique index player_profiles_display_name_ci
  on public.player_profiles (lower(display_name));

create table public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint friend_requests_not_self check (requester_id <> recipient_id),
  constraint friend_requests_status_check check (status in ('pending', 'accepted', 'rejected', 'removed'))
);

-- Prevent duplicate pending requests and duplicate accepted friendships in either direction.
create unique index friend_requests_one_active_pair
  on public.friend_requests (
    least(requester_id, recipient_id),
    greatest(requester_id, recipient_id)
  )
  where status in ('pending', 'accepted');

create index friend_requests_recipient_pending
  on public.friend_requests (recipient_id, created_at desc)
  where status = 'pending';

create index friend_requests_requester_pending
  on public.friend_requests (requester_id, created_at desc)
  where status = 'pending';

alter table public.player_profiles enable row level security;
alter table public.friend_requests enable row level security;

revoke all on public.player_profiles from anon, authenticated;
revoke all on public.friend_requests from anon, authenticated;
grant select on public.player_profiles to authenticated;
grant select on public.friend_requests to authenticated;

create policy player_profiles_read_searchable_or_self
  on public.player_profiles for select to authenticated
  using (is_searchable or user_id = (select auth.uid()));

create policy friend_requests_read_participant
  on public.friend_requests for select to authenticated
  using (
    requester_id = (select auth.uid())
    or recipient_id = (select auth.uid())
  );

create or replace function public.upsert_my_profile(
  p_display_name text,
  p_avatar_id text default 'brand'
)
returns public.player_profiles
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
  v_avatar text := coalesce(p_avatar_id, 'brand');
  v_profile public.player_profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(v_name) not between 3 and 24 or v_name !~ '^[[:alnum:]_ -]{3,24}$' then
    raise exception 'Display name must be 3-24 letters, numbers, spaces, underscores or hyphens';
  end if;
  if v_avatar not in ('brand', 'Warrior', 'Mage', 'Assassin', 'Archer') then
    raise exception 'Unsupported avatar';
  end if;

  insert into public.player_profiles (user_id, display_name, avatar_id)
  values (v_user_id, v_name, v_avatar)
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_id = excluded.avatar_id,
        updated_at = now()
  returning * into v_profile;

  return v_profile;
end;
$$;

create or replace function public.search_players(p_query text)
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  friend_state text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_query text := btrim(coalesce(p_query, ''));
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if char_length(v_query) < 3 then
    raise exception 'Search query must contain at least 3 characters';
  end if;

  return query
  select p.user_id, p.display_name, p.avatar_id,
    case
      when exists (
        select 1 from public.friend_requests f
        where f.status = 'accepted'
          and least(f.requester_id, f.recipient_id) = least(v_user_id, p.user_id)
          and greatest(f.requester_id, f.recipient_id) = greatest(v_user_id, p.user_id)
      ) then 'friends'
      when exists (
        select 1 from public.friend_requests f
        where f.status = 'pending' and f.requester_id = v_user_id and f.recipient_id = p.user_id
      ) then 'outgoing'
      when exists (
        select 1 from public.friend_requests f
        where f.status = 'pending' and f.requester_id = p.user_id and f.recipient_id = v_user_id
      ) then 'incoming'
      else 'none'
    end as friend_state
  from public.player_profiles p
  where p.is_searchable
    and p.user_id <> v_user_id
    and p.display_name ilike '%' || v_query || '%'
  order by lower(p.display_name)
  limit 20;
end;
$$;

create or replace function public.send_friend_request(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_recipient_id is null or p_recipient_id = v_user_id then
    raise exception 'Invalid friend recipient';
  end if;
  if not exists (
    select 1 from public.player_profiles p
    where p.user_id = p_recipient_id and p.is_searchable
  ) then
    raise exception 'Player not found';
  end if;
  if exists (
    select 1 from public.friend_requests f
    where f.status in ('pending', 'accepted')
      and least(f.requester_id, f.recipient_id) = least(v_user_id, p_recipient_id)
      and greatest(f.requester_id, f.recipient_id) = greatest(v_user_id, p_recipient_id)
  ) then
    raise exception 'A request or friendship already exists';
  end if;

  insert into public.friend_requests (requester_id, recipient_id)
  values (v_user_id, p_recipient_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

create or replace function public.respond_friend_request(
  p_request_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.friend_requests
    set status = case when p_accept then 'accepted' else 'rejected' end,
        updated_at = now(),
        responded_at = now()
  where id = p_request_id
    and recipient_id = v_user_id
    and status = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Pending friend request not found';
  end if;
end;
$$;

create or replace function public.remove_friend(p_friend_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_rows integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_friend_id is null or p_friend_id = v_user_id then
    raise exception 'Invalid friend';
  end if;

  update public.friend_requests
    set status = 'removed', updated_at = now()
  where status = 'accepted'
    and least(requester_id, recipient_id) = least(v_user_id, p_friend_id)
    and greatest(requester_id, recipient_id) = greatest(v_user_id, p_friend_id);

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Friendship not found';
  end if;
end;
$$;

create or replace function public.list_my_friends()
returns table (
  user_id uuid,
  display_name text,
  avatar_id text,
  friends_since timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.user_id, p.display_name, p.avatar_id, f.created_at
  from public.friend_requests f
  join public.player_profiles p
    on p.user_id = case when f.requester_id = auth.uid() then f.recipient_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.recipient_id = auth.uid())
  order by lower(p.display_name);
$$;

revoke all on function public.upsert_my_profile(text, text) from public, anon;
revoke all on function public.search_players(text) from public, anon;
revoke all on function public.send_friend_request(uuid) from public, anon;
revoke all on function public.respond_friend_request(uuid, boolean) from public, anon;
revoke all on function public.remove_friend(uuid) from public, anon;
revoke all on function public.list_my_friends() from public, anon;

grant execute on function public.upsert_my_profile(text, text) to authenticated;
grant execute on function public.search_players(text) to authenticated;
grant execute on function public.send_friend_request(uuid) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.list_my_friends() to authenticated;
