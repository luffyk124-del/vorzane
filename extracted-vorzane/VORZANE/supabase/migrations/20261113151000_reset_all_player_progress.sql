-- Full VORZANE player/account reset. Preserve the Supabase project, schemas,
-- auth configuration, database objects, and storage buckets; remove all user data.
-- Private snapshots are temporary recovery evidence and are not API-accessible.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Never delete Storage metadata directly: it can orphan binary objects. There
-- are currently no buckets/objects; stop safely if that changes before launch.
do $guard$
begin
  if exists (select 1 from storage.objects) then
    raise exception 'Storage objects exist. Remove user-owned files through the Storage API before running the full reset.';
  end if;
  if exists (select 1 from auth.scim_users) then
    raise exception 'SCIM-linked users exist. Review them before deleting auth.users.';
  end if;
end
$guard$;

-- Keep only non-credential account identifiers. Password hashes, refresh
-- tokens, identities and sessions are deliberately not copied to the backup.
create table private.auth_users_pre_reset_20261113 as
select id, created_at, updated_at
from auth.users;
revoke all on table private.auth_users_pre_reset_20261113 from public, anon, authenticated;

create table private.player_saves_pre_reset_20261113 as
select * from public.player_saves;
revoke all on table private.player_saves_pre_reset_20261113 from public, anon, authenticated;

create table private.player_profiles_pre_reset_20261113 as
select * from public.player_profiles;
revoke all on table private.player_profiles_pre_reset_20261113 from public, anon, authenticated;

create table private.friend_requests_pre_reset_20261113 as
select * from public.friend_requests;
revoke all on table private.friend_requests_pre_reset_20261113 from public, anon, authenticated;

create table private.player_notifications_pre_reset_20261113 as
select * from public.player_notifications;
revoke all on table private.player_notifications_pre_reset_20261113 from public, anon, authenticated;

create table private.player_command_receipts_pre_reset_20261113 as
select * from public.player_command_receipts;
revoke all on table private.player_command_receipts_pre_reset_20261113 from public, anon, authenticated;

-- Clear app records and auth audit history. Deleting auth.users also cascades
-- to identities, sessions, refresh tokens, MFA and other account-owned rows.
delete from public.player_notifications;
delete from public.friend_requests;
delete from public.player_command_receipts;
delete from public.player_profiles;
delete from public.player_saves;
delete from auth.audit_log_entries;
delete from auth.users;

do $verify$
begin
  if exists (select 1 from auth.users)
     or exists (select 1 from public.player_saves)
     or exists (select 1 from public.player_profiles)
     or exists (select 1 from public.friend_requests)
     or exists (select 1 from public.player_notifications)
     or exists (select 1 from public.player_command_receipts)
     or exists (select 1 from auth.sessions)
     or exists (select 1 from auth.identities)
     or exists (select 1 from auth.refresh_tokens) then
    raise exception 'Full reset verification failed: user or account data remains.';
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.player_saves') is null
     or to_regclass('public.player_profiles') is null
     or to_regclass('public.friend_requests') is null
     or to_regclass('public.player_notifications') is null
     or to_regclass('storage.buckets') is null then
    raise exception 'Full reset verification failed: required project schema is missing.';
  end if;

  if has_table_privilege('anon','private.auth_users_pre_reset_20261113','SELECT')
     or has_table_privilege('authenticated','private.auth_users_pre_reset_20261113','SELECT')
     or has_table_privilege('anon','private.player_saves_pre_reset_20261113','SELECT')
     or has_table_privilege('authenticated','private.player_saves_pre_reset_20261113','SELECT') then
    raise exception 'Full reset backup must not be readable by client roles.';
  end if;
end
$verify$;
