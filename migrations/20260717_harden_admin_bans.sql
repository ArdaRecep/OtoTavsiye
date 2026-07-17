begin;

create or replace function public.admin_apply_user_ban(
  p_admin_user_id uuid,
  p_user_id uuid,
  p_ban_type text,
  p_duration_days integer default null,
  p_reason text default null
)
returns table (
  ban_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ban_id uuid;
  v_expires_at timestamptz;
begin
  if not exists (
    select 1
    from public.users admin_user
    where admin_user.id = p_admin_user_id and admin_user.is_admin = true
  ) then raise exception 'ADMIN_REQUIRED'; end if;

  if p_admin_user_id = p_user_id then raise exception 'CANNOT_BAN_SELF'; end if;
  if p_ban_type not in ('chat', 'access') then raise exception 'INVALID_BAN_TYPE'; end if;
  if not exists (select 1 from public.users target where target.id = p_user_id) then raise exception 'USER_NOT_FOUND'; end if;
  if exists (select 1 from public.users target where target.id = p_user_id and target.is_admin = true) then
    raise exception 'CANNOT_BAN_ADMIN';
  end if;

  v_expires_at := case
    when p_duration_days is null then null
    else now() + make_interval(days => least(365, greatest(1, p_duration_days)))
  end;

  update public.user_bans existing_ban
  set revoked_at = now()
  where existing_ban.user_id = p_user_id
    and existing_ban.ban_type = p_ban_type
    and existing_ban.revoked_at is null;

  insert into public.user_bans (user_id, ban_type, reason, expires_at, created_by)
  values (p_user_id, p_ban_type, nullif(left(trim(coalesce(p_reason, '')), 500), ''), v_expires_at, p_admin_user_id)
  returning id into v_ban_id;

  if p_ban_type = 'access' then
    update public.auth_identity_bans identity_ban
    set revoked_at = now()
    where identity_ban.source_user_id = p_user_id
      and identity_ban.revoked_at is null;

    insert into public.auth_identity_bans (
      identity_type,
      identity_hash,
      source_user_id,
      reason,
      expires_at,
      created_by
    )
    select
      identity.identity_type,
      identity.identity_hash,
      p_user_id,
      nullif(left(trim(coalesce(p_reason, '')), 500), ''),
      v_expires_at,
      p_admin_user_id
    from public.user_auth_identities identity
    where identity.user_id = p_user_id;
  end if;

  return query select v_ban_id, v_expires_at;
end;
$function$;

create or replace function public.admin_revoke_user_ban(
  p_admin_user_id uuid,
  p_user_id uuid,
  p_ban_type text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.users admin_user
    where admin_user.id = p_admin_user_id and admin_user.is_admin = true
  ) then raise exception 'ADMIN_REQUIRED'; end if;

  if p_ban_type not in ('chat', 'access') then raise exception 'INVALID_BAN_TYPE'; end if;

  update public.user_bans existing_ban
  set revoked_at = now()
  where existing_ban.user_id = p_user_id
    and existing_ban.ban_type = p_ban_type
    and existing_ban.revoked_at is null;

  if p_ban_type = 'access' then
    update public.auth_identity_bans identity_ban
    set revoked_at = now()
    where identity_ban.source_user_id = p_user_id
      and identity_ban.revoked_at is null;
  end if;

  return true;
end;
$function$;

revoke all on function public.admin_apply_user_ban(uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.admin_revoke_user_ban(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_apply_user_ban(uuid, uuid, text, integer, text) to service_role;
grant execute on function public.admin_revoke_user_ban(uuid, uuid, text) to service_role;

commit;
