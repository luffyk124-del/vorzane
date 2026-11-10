-- Public player cards: discoverable by every authenticated player.
-- The full player_saves table remains protected by its existing owner-only RLS policy.

update public.player_profiles
set is_searchable = true
where is_searchable is distinct from true;

drop policy if exists player_profiles_read_searchable_or_self on public.player_profiles;
create policy player_profiles_read_all_authenticated
  on public.player_profiles for select to authenticated
  using (true);

create or replace function public.set_my_profile_searchable(p_enabled boolean)
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
  update public.player_profiles
    set is_searchable = true, updated_at = now()
  where user_id = v_user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Create your player profile first';
  end if;
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
  if v_query !~ '^[[:alnum:]_ -]{3,24}$' then
    raise exception 'Search query contains unsupported characters';
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
  where p.user_id <> v_user_id
    and position(lower(v_query) in lower(p.display_name)) > 0
  order by lower(p.display_name)
  limit 20;
end;
$$;

create or replace function public.get_public_player_profile(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller uuid := auth.uid();
  v_profile public.player_profiles;
  v_state jsonb;
  v_hero jsonb;
  v_equipped jsonb;
  v_stats jsonb;
  v_style jsonb;
begin
  if v_caller is null then
    raise exception 'Authentication required';
  end if;
  if p_user_id is null then
    raise exception 'Player not found';
  end if;

  select * into v_profile
  from public.player_profiles
  where user_id = p_user_id;
  if not found then
    return null;
  end if;

  select game_state into v_state
  from public.player_saves
  where user_id = p_user_id;

  v_hero := coalesce(v_state -> 'hero', '{}'::jsonb);
  select coalesce(jsonb_object_agg(e.key, jsonb_build_object(
    'name', e.value ->> 'name',
    'rarity', e.value ->> 'rarity'
  )), '{}'::jsonb)
  into v_equipped
  from jsonb_each(coalesce(v_state -> 'equipped', '{}'::jsonb)) e
  where jsonb_typeof(e.value) = 'object';

  select coalesce(jsonb_object_agg(s.key, s.value), '{}'::jsonb)
  into v_stats
  from jsonb_each(coalesce(v_hero -> 'stats', '{}'::jsonb)) s
  where s.key in ('str', 'def', 'vit', 'agi', 'luck')
    and jsonb_typeof(s.value) = 'number';

  v_style := coalesce(v_state -> 'characterStyle', '{}'::jsonb);

  return jsonb_build_object(
    'user_id', v_profile.user_id,
    'display_name', v_profile.display_name,
    'avatar_id', v_profile.avatar_id,
    'character_gender', case when v_style ->> 'gender' = 'female' then 'female' else 'male' end,
    'hero_name', coalesce(v_hero ->> 'name', v_profile.display_name),
    'class_name', coalesce(v_hero ->> 'className', 'Warrior'),
    'level', coalesce((substring(v_hero ->> 'level' from '^[0-9]{1,4}'))::integer, 1),
    'stats', v_stats,
    'equipped', v_equipped,
    'active_pet', v_state ->> 'activePet',
    'wins', coalesce((substring(v_state ->> 'wins' from '^[0-9]{1,10}'))::integer, 0),
    'battles', coalesce((substring(v_state ->> 'battles' from '^[0-9]{1,10}'))::integer, 0),
    'dimas_floor', coalesce((substring(v_state #>> '{dimas,highestFloor}' from '^[0-9]{1,3}'))::integer, 0),
    'roaming_events', coalesce((substring(v_state #>> '{roaming,eventsCompleted}' from '^[0-9]{1,10}'))::integer, 0)
  );
end;
$$;

revoke all on function public.get_public_player_profile(uuid) from public, anon;
grant execute on function public.get_public_player_profile(uuid) to authenticated;
