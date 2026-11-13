-- Full VORZANE player/account reset. Preserve the Supabase project, schemas,
-- auth configuration, database objects, and storage buckets; remove user data.
-- Backups contain application data and account IDs only, never password hashes
-- or bearer/refresh tokens. They are private and temporary.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Stop safely if Storage or SCIM has data that needs provider-aware handling.
do $guard$
declare
  has_rows boolean := false;
begin
  if to_regclass('storage.objects') is not null then
    execute 'select exists (select 1 from storage.objects)' into has_rows;
    if has_rows then
      raise exception 'Storage objects exist. Remove user-owned files through the Storage API before running the full reset.';
    end if;
  end if;

  has_rows := false;
  if to_regclass('auth.scim_users') is not null then
    execute 'select exists (select 1 from auth.scim_users)' into has_rows;
    if has_rows then
      raise exception 'SCIM-linked users exist. Review them before deleting auth.users.';
    end if;
  end if;
end
$guard$;

-- Preserve non-credential account IDs and all application-owned records.
create table private.auth_users_pre_reset_20261113 as
select id from auth.users;
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

-- Recovery quarantine tables exist in CI and may be added to production later.
do $backup_optional$
begin
  if to_regclass('public.player_save_recovery') is not null then
    execute 'create table private.player_save_recovery_pre_reset_20261113 as select * from public.player_save_recovery';
    execute 'revoke all on table private.player_save_recovery_pre_reset_20261113 from public, anon, authenticated';
    execute 'delete from public.player_save_recovery';
  end if;

  if to_regclass('vorzane_internal.player_save_recovery_quotas') is not null then
    execute 'create table private.player_save_recovery_quotas_pre_reset_20261113 as select * from vorzane_internal.player_save_recovery_quotas';
    execute 'revoke all on table private.player_save_recovery_quotas_pre_reset_20261113 from public, anon, authenticated';
    execute 'delete from vorzane_internal.player_save_recovery_quotas';
  end if;
end
$backup_optional$;

-- Clear application records and auth audit/transient state. Deleting auth.users
-- cascades to identities, sessions, refresh tokens, MFA and account-owned rows.
delete from public.player_notifications;
delete from public.friend_requests;
delete from public.player_command_receipts;
delete from public.player_profiles;
delete from public.player_saves;

do $clear_auth_aux$
begin
  if to_regclass('auth.audit_log_entries') is not null then
    execute 'delete from auth.audit_log_entries';
  end if;
  if to_regclass('auth.flow_state') is not null then
    execute 'delete from auth.flow_state';
  end if;
  if to_regclass('auth.oauth_client_states') is not null then
    execute 'delete from auth.oauth_client_states';
  end if;
  if to_regclass('auth.saml_relay_states') is not null then
    execute 'delete from auth.saml_relay_states';
  end if;
  if to_regclass('auth.mfa_challenges') is not null then
    execute 'delete from auth.mfa_challenges';
  end if;
end
$clear_auth_aux$;

delete from auth.users;

do $verify$
declare
  has_rows boolean := false;
begin
  if exists (select 1 from auth.users)
     or exists (select 1 from public.player_saves)
     or exists (select 1 from public.player_profiles)
     or exists (select 1 from public.friend_requests)
     or exists (select 1 from public.player_notifications)
     or exists (select 1 from public.player_command_receipts) then
    raise exception 'Full reset verification failed: user or player data remains.';
  end if;

  -- These managed Auth tables vary by Supabase version and are absent from the
  -- lightweight PostgreSQL CI fixture, so verify them only when present.
  if to_regclass('auth.sessions') is not null then
    execute 'select exists (select 1 from auth.sessions)' into has_rows;
    if has_rows then raise exception 'Full reset verification failed: sessions remain.'; end if;
  end if;
  if to_regclass('auth.identities') is not null then
    execute 'select exists (select 1 from auth.identities)' into has_rows;
    if has_rows then raise exception 'Full reset verification failed: identities remain.'; end if;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'select exists (select 1 from auth.refresh_tokens)' into has_rows;
    if has_rows then raise exception 'Full reset verification failed: refresh tokens remain.'; end if;
  end if;

  if to_regclass('auth.users') is null
     or to_regclass('public.player_saves') is null
     or to_regclass('public.player_profiles') is null
     or to_regclass('public.friend_requests') is null
     or to_regclass('public.player_notifications') is null then
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
