-- Additive in-app notification inbox for social events.
-- Safe to test in CI; do not apply to the user's production Supabase project without approval.

create table public.player_notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  notification_type text not null,
  friend_request_id uuid references public.friend_requests(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint player_notifications_type_check
    check (notification_type in ('friend_request', 'friend_request_accepted')),
  constraint player_notifications_friend_request_required
    check (friend_request_id is not null)
);

create unique index player_notifications_dedupe
  on public.player_notifications (recipient_id, notification_type, friend_request_id);

create index player_notifications_inbox
  on public.player_notifications (recipient_id, created_at desc);

alter table public.player_notifications enable row level security;

revoke all on public.player_notifications from anon, authenticated;
grant select on public.player_notifications to authenticated;
grant update (read_at) on public.player_notifications to authenticated;

create policy player_notifications_read_own
  on public.player_notifications for select to authenticated
  using (recipient_id = (select auth.uid()));

create policy player_notifications_update_own
  on public.player_notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

create or replace function public.create_friend_notification()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if TG_OP = 'INSERT' and NEW.status = 'pending' then
    insert into public.player_notifications (recipient_id, actor_id, notification_type, friend_request_id)
    values (NEW.recipient_id, NEW.requester_id, 'friend_request', NEW.id)
    on conflict (recipient_id, notification_type, friend_request_id) do nothing;
  elsif TG_OP = 'UPDATE' and OLD.status = 'pending' and NEW.status = 'accepted' then
    insert into public.player_notifications (recipient_id, actor_id, notification_type, friend_request_id)
    values (NEW.requester_id, NEW.recipient_id, 'friend_request_accepted', NEW.id)
    on conflict (recipient_id, notification_type, friend_request_id) do nothing;
  end if;
  return NEW;
end;
$$;

revoke all on function public.create_friend_notification() from public, anon, authenticated;

create trigger player_friend_request_notification_insert
  after insert on public.friend_requests
  for each row execute function public.create_friend_notification();

create trigger player_friend_request_notification_accept
  after update of status on public.friend_requests
  for each row execute function public.create_friend_notification();

create or replace function public.list_my_notifications()
returns table (
  notification_id uuid,
  notification_type text,
  actor_name text,
  created_at timestamptz,
  read_at timestamptz,
  friend_request_id uuid
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  return query
  select n.id, n.notification_type, coalesce(p.display_name, 'لاعب VORZANE'),
         n.created_at, n.read_at, n.friend_request_id
  from public.player_notifications n
  left join public.player_profiles p on p.user_id = n.actor_id
  where n.recipient_id = v_user_id
  order by n.created_at desc
  limit 50;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
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
  update public.player_notifications
    set read_at = coalesce(read_at, now())
  where id = p_notification_id and recipient_id = v_user_id;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Notification not found';
  end if;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  update public.player_notifications
    set read_at = now()
  where recipient_id = v_user_id and read_at is null;
end;
$$;

revoke all on function public.list_my_notifications() from public, anon;
revoke all on function public.mark_notification_read(uuid) from public, anon;
revoke all on function public.mark_all_notifications_read() from public, anon;

grant execute on function public.list_my_notifications() to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
