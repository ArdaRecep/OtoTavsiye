create extension if not exists pgcrypto;

create or replace function public.current_app_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid;
  v_headers jsonb;
  v_header_user_id text;
begin
  v_auth_user_id := auth.uid();
  if v_auth_user_id is not null then
    return v_auth_user_id;
  end if;

  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
    v_header_user_id := v_headers ->> 'x-user-id';
  exception when others then
    v_header_user_id := null;
  end;

  if v_header_user_id is null or btrim(v_header_user_id) = '' then
    return null;
  end if;

  begin
    return v_header_user_id::uuid;
  exception when invalid_text_representation then
    return null;
  end;
end;
$$;

create table if not exists public.vehicle_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  vehicle_id varchar not null references public.vehicle_market_profiles(id) on delete cascade,
  rating numeric(2,1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_ratings_user_id_vehicle_id_key unique (user_id, vehicle_id),
  constraint vehicle_ratings_rating_range_check check (rating >= 0.5 and rating <= 5.0),
  constraint vehicle_ratings_rating_half_step_check check ((rating * 2) = floor(rating * 2))
);

create index if not exists idx_vehicle_ratings_vehicle_id on public.vehicle_ratings (vehicle_id);
create index if not exists idx_vehicle_ratings_user_id on public.vehicle_ratings (user_id);

create or replace function public.set_vehicle_ratings_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_vehicle_ratings_updated_at on public.vehicle_ratings;
create trigger set_vehicle_ratings_updated_at
before update on public.vehicle_ratings
for each row execute function public.set_vehicle_ratings_updated_at();

alter table public.vehicle_ratings enable row level security;

drop policy if exists "vehicle_ratings_select_all" on public.vehicle_ratings;
create policy "vehicle_ratings_select_all"
on public.vehicle_ratings
for select
using (true);

drop policy if exists "vehicle_ratings_insert_own" on public.vehicle_ratings;
create policy "vehicle_ratings_insert_own"
on public.vehicle_ratings
for insert
with check (auth.uid() = user_id);

drop policy if exists "vehicle_ratings_update_own" on public.vehicle_ratings;
create policy "vehicle_ratings_update_own"
on public.vehicle_ratings
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "vehicle_ratings_delete_own" on public.vehicle_ratings;
create policy "vehicle_ratings_delete_own"
on public.vehicle_ratings
for delete
using (auth.uid() = user_id);

create or replace function public.rate_vehicle(p_vehicle_id varchar, p_rating numeric)
returns table (
  vehicle_id varchar,
  average_rating numeric,
  rating_count bigint,
  user_rating numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_rating numeric(2,1);
begin
  v_user_id := public.current_app_user_id();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_vehicle_id is null or btrim(p_vehicle_id) = '' then
    raise exception 'INVALID_VEHICLE_ID';
  end if;

  if p_rating is null or p_rating < 0.5 or p_rating > 5.0 or (p_rating * 2) <> floor(p_rating * 2) then
    raise exception 'INVALID_RATING';
  end if;

  v_rating := p_rating::numeric(2,1);

  insert into public.vehicle_ratings (user_id, vehicle_id, rating)
  values (v_user_id, p_vehicle_id, v_rating)
  on conflict on constraint vehicle_ratings_user_id_vehicle_id_key
  do update set
    rating = excluded.rating,
    updated_at = now();

  return query
  select
    p_vehicle_id::varchar,
    coalesce((select round(avg(vr.rating)::numeric, 1) from public.vehicle_ratings vr where vr.vehicle_id = p_vehicle_id), 0::numeric),
    (select count(*) from public.vehicle_ratings vr where vr.vehicle_id = p_vehicle_id)::bigint,
    (select vr.rating from public.vehicle_ratings vr where vr.vehicle_id = p_vehicle_id and vr.user_id = v_user_id limit 1)::numeric;
end;
$$;

create or replace function public.get_vehicle_rating_state(p_vehicle_id varchar)
returns table (
  vehicle_id varchar,
  average_rating numeric,
  rating_count bigint,
  user_rating numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.current_app_user_id();

  return query
  select
    p_vehicle_id::varchar,
    coalesce((select round(avg(vr.rating)::numeric, 1) from public.vehicle_ratings vr where vr.vehicle_id = p_vehicle_id), 0::numeric),
    (select count(*) from public.vehicle_ratings vr where vr.vehicle_id = p_vehicle_id)::bigint,
    case
      when v_user_id is null then null::numeric
      else (select vr.rating from public.vehicle_ratings vr where vr.vehicle_id = p_vehicle_id and vr.user_id = v_user_id limit 1)::numeric
    end;
end;
$$;

create or replace function public.toggle_vehicle_favorite(p_vehicle_id varchar)
returns table (
  vehicle_id varchar,
  is_favorited boolean,
  favorite_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.current_app_user_id();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if exists (
    select 1
    from public.vehicle_favorites vf
    where vf.vehicle_id = p_vehicle_id
      and vf.user_id = v_user_id
  ) then
    delete from public.vehicle_favorites vf
    where vf.vehicle_id = p_vehicle_id
      and vf.user_id = v_user_id;
  else
    insert into public.vehicle_favorites (user_id, vehicle_id)
    values (v_user_id, p_vehicle_id)
    on conflict on constraint vehicle_favorites_user_id_vehicle_id_key do nothing;
  end if;

  return query
  select
    p_vehicle_id::varchar,
    exists (
      select 1
      from public.vehicle_favorites vf
      where vf.vehicle_id = p_vehicle_id
        and vf.user_id = v_user_id
    ) as is_favorited,
    (select count(*) from public.vehicle_favorites vf where vf.vehicle_id = p_vehicle_id)::bigint as favorite_count;
end;
$$;

create or replace function public.get_vehicle_favorite_state(p_vehicle_id varchar)
returns table (
  vehicle_id varchar,
  is_favorited boolean,
  favorite_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.current_app_user_id();

  return query
  select
    p_vehicle_id::varchar,
    case
      when v_user_id is null then false
      else exists (
        select 1
        from public.vehicle_favorites vf
        where vf.vehicle_id = p_vehicle_id
          and vf.user_id = v_user_id
      )
    end as is_favorited,
    (select count(*) from public.vehicle_favorites vf where vf.vehicle_id = p_vehicle_id)::bigint as favorite_count;
end;
$$;

create or replace function public.get_vehicle_social_state(p_vehicle_ids varchar[])
returns table (
  vehicle_id varchar,
  average_rating numeric,
  rating_count bigint,
  user_rating numeric,
  favorite_count bigint,
  is_favorited boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.current_app_user_id();

  return query
  with requested as (
    select distinct unnest(coalesce(p_vehicle_ids, array[]::varchar[]))::varchar as id
  )
  select
    requested.id::varchar as vehicle_id,
    coalesce(round(avg(vr.rating)::numeric, 1), 0::numeric) as average_rating,
    count(vr.id)::bigint as rating_count,
    max(vr.rating) filter (where vr.user_id = v_user_id)::numeric as user_rating,
    (select count(*) from public.vehicle_favorites vf where vf.vehicle_id = requested.id)::bigint as favorite_count,
    case
      when v_user_id is null then false
      else exists (
        select 1
        from public.vehicle_favorites vf
        where vf.vehicle_id = requested.id
          and vf.user_id = v_user_id
      )
    end as is_favorited
  from requested
  left join public.vehicle_ratings vr on vr.vehicle_id = requested.id
  group by requested.id
  order by array_position(p_vehicle_ids, requested.id);
end;
$$;

create or replace function public.toggle_comment_reaction(p_comment_id uuid, p_type text)
returns table (
  comment_id uuid,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_existing_type text;
begin
  v_user_id := public.current_app_user_id();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_type not in ('like', 'dislike') then
    raise exception 'INVALID_REACTION_TYPE';
  end if;

  select ci.type
  into v_existing_type
  from public.comment_interactions ci
  where ci.comment_id = p_comment_id
    and ci.user_id = v_user_id
  for update;

  if v_existing_type is null then
    insert into public.comment_interactions (comment_id, user_id, type)
    values (p_comment_id, v_user_id, p_type)
    on conflict on constraint comment_interactions_comment_id_user_id_key
    do update set type = excluded.type;
  elsif v_existing_type = p_type then
    delete from public.comment_interactions ci
    where ci.comment_id = p_comment_id
      and ci.user_id = v_user_id;
  else
    update public.comment_interactions ci
    set type = p_type
    where ci.comment_id = p_comment_id
      and ci.user_id = v_user_id;
  end if;

  return query
  select
    p_comment_id::uuid,
    count(*) filter (where ci.type = 'like')::bigint,
    count(*) filter (where ci.type = 'dislike')::bigint,
    (
      select ci_current.type
      from public.comment_interactions ci_current
      where ci_current.comment_id = p_comment_id
        and ci_current.user_id = v_user_id
      limit 1
    )::text
  from public.comment_interactions ci
  where ci.comment_id = p_comment_id;
end;
$$;

create or replace function public.get_vehicle_comments(p_vehicle_id varchar)
returns table (
  id uuid,
  vehicle_id varchar,
  parent_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  author_username text,
  author_avatar_url text,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text,
  reply_count bigint,
  author_car_rating numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  v_user_id := public.current_app_user_id();

  return query
  select
    vc.id,
    vc.vehicle_id,
    vc.parent_id,
    vc.user_id,
    vc.content,
    vc.created_at,
    coalesce(u.username, 'Kullanıcı')::text as author_username,
    u.avatar_url::text as author_avatar_url,
    count(ci.id) filter (where ci.type = 'like')::bigint as like_count,
    count(ci.id) filter (where ci.type = 'dislike')::bigint as dislike_count,
    max(ci.type) filter (where ci.user_id = v_user_id)::text as current_user_reaction,
    (
      select count(*)
      from public.vehicle_comments child
      where child.parent_id = vc.id
    )::bigint as reply_count,
    (
      select vr.rating
      from public.vehicle_ratings vr
      where vr.vehicle_id = vc.vehicle_id
        and vr.user_id = vc.user_id
      limit 1
    )::numeric as author_car_rating
  from public.vehicle_comments vc
  left join public.users u on u.id = vc.user_id
  left join public.comment_interactions ci on ci.comment_id = vc.id
  where vc.vehicle_id = p_vehicle_id
  group by vc.id, vc.vehicle_id, vc.parent_id, vc.user_id, vc.content, vc.created_at, u.username, u.avatar_url
  order by vc.created_at asc;
end;
$$;

create or replace function public.create_vehicle_comment(
  p_vehicle_id varchar,
  p_content text,
  p_parent_id uuid default null
)
returns table (
  id uuid,
  vehicle_id varchar,
  parent_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  author_username text,
  author_avatar_url text,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text,
  reply_count bigint,
  author_car_rating numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_content text;
  v_comment_id uuid;
begin
  v_user_id := public.current_app_user_id();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_content := btrim(coalesce(p_content, ''));
  if char_length(v_content) < 1 or char_length(v_content) > 1000 then
    raise exception 'INVALID_COMMENT_LENGTH';
  end if;

  if p_parent_id is not null and not exists (
    select 1
    from public.vehicle_comments parent
    where parent.id = p_parent_id
      and parent.vehicle_id = p_vehicle_id
  ) then
    raise exception 'INVALID_PARENT_COMMENT';
  end if;

  insert into public.vehicle_comments (vehicle_id, user_id, parent_id, content)
  values (p_vehicle_id, v_user_id, p_parent_id, v_content)
  returning vehicle_comments.id into v_comment_id;

  return query
  select comments.*
  from public.get_vehicle_comments(p_vehicle_id) comments
  where comments.id = v_comment_id;
end;
$$;

grant execute on function public.current_app_user_id() to anon, authenticated, service_role;
grant execute on function public.rate_vehicle(varchar, numeric) to anon, authenticated, service_role;
grant execute on function public.get_vehicle_rating_state(varchar) to anon, authenticated, service_role;
grant execute on function public.toggle_vehicle_favorite(varchar) to anon, authenticated, service_role;
grant execute on function public.get_vehicle_favorite_state(varchar) to anon, authenticated, service_role;
grant execute on function public.get_vehicle_social_state(varchar[]) to anon, authenticated, service_role;
grant execute on function public.toggle_comment_reaction(uuid, text) to anon, authenticated, service_role;
grant execute on function public.get_vehicle_comments(varchar) to anon, authenticated, service_role;
grant execute on function public.create_vehicle_comment(varchar, text, uuid) to anon, authenticated, service_role;
