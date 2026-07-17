begin;

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

create table if not exists public.community_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 120),
  body text not null check (char_length(trim(body)) between 10 and 3000),
  category text not null check (category in ('vehicle_advice', 'ownership', 'technical', 'general')),
  vehicle_id varchar references public.vehicle_market_profiles(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comments (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.community_comments(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 1000),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_comment_interactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.community_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  constraint community_comment_interactions_comment_user_key unique (comment_id, user_id)
);

create index if not exists idx_community_threads_category_created
  on public.community_threads (category, created_at desc);
create index if not exists idx_community_threads_user
  on public.community_threads (user_id, created_at desc);
create index if not exists idx_community_threads_vehicle
  on public.community_threads (vehicle_id) where vehicle_id is not null;
create index if not exists idx_community_threads_title_trgm
  on public.community_threads using gin (title gin_trgm_ops);
create index if not exists idx_community_comments_thread_created
  on public.community_comments (thread_id, created_at);
create index if not exists idx_community_comments_parent
  on public.community_comments (parent_id) where parent_id is not null;
create index if not exists idx_community_comment_interactions_comment
  on public.community_comment_interactions (comment_id);

create or replace function public.touch_community_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists community_threads_touch_updated_at on public.community_threads;
create trigger community_threads_touch_updated_at
before update on public.community_threads
for each row execute function public.touch_community_updated_at();

drop trigger if exists community_comments_touch_updated_at on public.community_comments;
create trigger community_comments_touch_updated_at
before update on public.community_comments
for each row execute function public.touch_community_updated_at();

alter table public.community_threads enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_comment_interactions enable row level security;

drop policy if exists community_threads_public_read on public.community_threads;
create policy community_threads_public_read on public.community_threads
for select to anon, authenticated using (true);

drop policy if exists community_threads_insert_own on public.community_threads;
create policy community_threads_insert_own on public.community_threads
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists community_threads_update_own on public.community_threads;
create policy community_threads_update_own on public.community_threads
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists community_comments_public_read on public.community_comments;
create policy community_comments_public_read on public.community_comments
for select to anon, authenticated using (true);

drop policy if exists community_comments_insert_own on public.community_comments;
create policy community_comments_insert_own on public.community_comments
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists community_comment_interactions_public_read on public.community_comment_interactions;
create policy community_comment_interactions_public_read on public.community_comment_interactions
for select to anon, authenticated using (true);

drop policy if exists community_comment_interactions_insert_own on public.community_comment_interactions;
create policy community_comment_interactions_insert_own on public.community_comment_interactions
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists community_comment_interactions_update_own on public.community_comment_interactions;
create policy community_comment_interactions_update_own on public.community_comment_interactions
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists community_comment_interactions_delete_own on public.community_comment_interactions;
create policy community_comment_interactions_delete_own on public.community_comment_interactions
for delete to authenticated using (auth.uid() = user_id);

create or replace function public.assert_community_post_allowed(p_user_id uuid, p_content text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.user_bans ban
    where ban.user_id = p_user_id
      and ban.ban_type in ('chat', 'access')
      and ban.revoked_at is null
      and (ban.expires_at is null or ban.expires_at > now())
  ) then
    raise exception 'CHAT_BANNED';
  end if;

  if exists (
    select 1
    from public.forbidden_words forbidden
    where forbidden.active = true
      and strpos(
        ' ' || regexp_replace(lower(coalesce(p_content, '')), '[^[:alnum:]_]+', ' ', 'g') || ' ',
        ' ' || regexp_replace(lower(trim(forbidden.word)), '[^[:alnum:]_]+', ' ', 'g') || ' '
      ) > 0
  ) then
    raise exception 'FORBIDDEN_WORD';
  end if;
end;
$function$;

create or replace function public.get_community_threads(
  p_category text default null,
  p_search text default null,
  p_page integer default 0,
  p_page_size integer default 20
)
returns table (
  id uuid,
  title text,
  body text,
  category text,
  vehicle_id varchar,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid,
  author_username text,
  comment_count bigint,
  participant_count bigint,
  vehicle_make text,
  vehicle_model text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    thread.id,
    thread.title,
    thread.body,
    thread.category,
    thread.vehicle_id,
    thread.status,
    thread.created_at,
    thread.updated_at,
    thread.user_id,
    coalesce(author.username, 'Kullanıcı')::text,
    (
      select count(*) from public.community_comments comment
      where comment.thread_id = thread.id and comment.deleted_at is null
    )::bigint,
    (
      select count(distinct participant.user_id)
      from (
        select thread.user_id
        union all
        select comment.user_id from public.community_comments comment
        where comment.thread_id = thread.id and comment.deleted_at is null
      ) participant
    )::bigint,
    vehicle.make::text,
    vehicle.model::text,
    count(*) over()::bigint
  from public.community_threads thread
  left join public.users author on author.id = thread.user_id
  left join public.vehicle_market_profiles vehicle on vehicle.id = thread.vehicle_id
  where (p_category is null or thread.category = p_category)
    and (
      nullif(trim(coalesce(p_search, '')), '') is null
      or thread.title ilike '%' || trim(p_search) || '%'
      or thread.body ilike '%' || trim(p_search) || '%'
      or author.username ilike '%' || trim(p_search) || '%'
      or vehicle.make ilike '%' || trim(p_search) || '%'
      or vehicle.model ilike '%' || trim(p_search) || '%'
    )
  order by thread.updated_at desc, thread.created_at desc
  limit least(greatest(coalesce(p_page_size, 20), 10), 40)
  offset greatest(coalesce(p_page, 0), 0) * least(greatest(coalesce(p_page_size, 20), 10), 40);
$function$;

create or replace function public.get_community_thread(p_thread_id uuid)
returns table (
  id uuid,
  title text,
  body text,
  category text,
  vehicle_id varchar,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid,
  author_username text,
  comment_count bigint,
  participant_count bigint,
  vehicle_make text,
  vehicle_model text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    thread.id,
    thread.title,
    thread.body,
    thread.category,
    thread.vehicle_id,
    thread.status,
    thread.created_at,
    thread.updated_at,
    thread.user_id,
    coalesce(author.username, 'Kullanıcı')::text,
    (select count(*) from public.community_comments comment where comment.thread_id = thread.id and comment.deleted_at is null)::bigint,
    (
      select count(distinct participant.user_id)
      from (
        select thread.user_id
        union all
        select comment.user_id from public.community_comments comment
        where comment.thread_id = thread.id and comment.deleted_at is null
      ) participant
    )::bigint,
    vehicle.make::text,
    vehicle.model::text
  from public.community_threads thread
  left join public.users author on author.id = thread.user_id
  left join public.vehicle_market_profiles vehicle on vehicle.id = thread.vehicle_id
  where thread.id = p_thread_id;
$function$;

create or replace function public.create_community_thread(
  p_title text,
  p_body text,
  p_category text,
  p_vehicle_id varchar default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_thread_id uuid;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 5 and 120 then raise exception 'INVALID_TITLE'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 10 and 3000 then raise exception 'INVALID_BODY'; end if;
  if p_category not in ('vehicle_advice', 'ownership', 'technical', 'general') then raise exception 'INVALID_CATEGORY'; end if;
  perform public.assert_community_post_allowed(v_user_id, p_title || ' ' || p_body);
  if p_vehicle_id is not null and not exists (select 1 from public.vehicle_market_profiles where id = p_vehicle_id) then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.community_threads
    where user_id = v_user_id and created_at > now() - interval '30 seconds'
  ) then raise exception 'RATE_LIMIT'; end if;

  insert into public.community_threads (user_id, title, body, category, vehicle_id)
  values (v_user_id, trim(p_title), trim(p_body), p_category, p_vehicle_id)
  returning id into v_thread_id;
  return v_thread_id;
end;
$function$;

create or replace function public.get_community_comments(p_thread_id uuid)
returns table (
  id uuid,
  thread_id uuid,
  parent_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  author_username text,
  author_avatar_url text,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text,
  reply_count bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    comment.id,
    comment.thread_id,
    comment.parent_id,
    comment.user_id,
    case when comment.deleted_at is null then comment.content else '[silindi]' end,
    comment.created_at,
    coalesce(author.username, 'Kullanıcı')::text,
    author.avatar_url::text,
    count(interaction.id) filter (where interaction.type = 'like')::bigint,
    count(interaction.id) filter (where interaction.type = 'dislike')::bigint,
    max(interaction.type) filter (where interaction.user_id = auth.uid())::text,
    (select count(*) from public.community_comments child where child.parent_id = comment.id and child.deleted_at is null)::bigint
  from public.community_comments comment
  left join public.users author on author.id = comment.user_id
  left join public.community_comment_interactions interaction on interaction.comment_id = comment.id
  where comment.thread_id = p_thread_id
  group by comment.id, author.username, author.avatar_url
  order by comment.created_at asc;
$function$;

create or replace function public.create_community_comment(
  p_thread_id uuid,
  p_content text,
  p_parent_id uuid default null
)
returns table (
  id uuid,
  thread_id uuid,
  parent_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  author_username text,
  author_avatar_url text,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text,
  reply_count bigint
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_comment public.community_comments%rowtype;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_content, ''))) not between 1 and 1000 then raise exception 'INVALID_CONTENT'; end if;
  perform public.assert_community_post_allowed(v_user_id, p_content);
  if not exists (select 1 from public.community_threads thread where thread.id = p_thread_id) then raise exception 'THREAD_NOT_FOUND'; end if;
  if exists (select 1 from public.community_threads thread where thread.id = p_thread_id and thread.status = 'closed') then raise exception 'THREAD_CLOSED'; end if;
  if p_parent_id is not null and not exists (
    select 1 from public.community_comments parent where parent.id = p_parent_id and parent.thread_id = p_thread_id
  ) then raise exception 'INVALID_PARENT'; end if;
  if exists (
    select 1 from public.community_comments recent_comment
    where recent_comment.user_id = v_user_id
      and recent_comment.created_at > now() - interval '5 seconds'
  ) then raise exception 'RATE_LIMIT'; end if;

  insert into public.community_comments (thread_id, user_id, parent_id, content)
  values (p_thread_id, v_user_id, p_parent_id, trim(p_content))
  returning * into v_comment;

  update public.community_threads set updated_at = now() where community_threads.id = p_thread_id;

  return query
  select
    v_comment.id,
    v_comment.thread_id,
    v_comment.parent_id,
    v_comment.user_id,
    v_comment.content,
    v_comment.created_at,
    coalesce(author.username, 'Kullanıcı')::text,
    author.avatar_url::text,
    0::bigint,
    0::bigint,
    null::text,
    0::bigint
  from public.users author
  where author.id = v_user_id;
end;
$function$;

create or replace function public.toggle_community_comment_reaction(p_comment_id uuid, p_type text)
returns table (
  comment_id uuid,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing_type text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_type not in ('like', 'dislike') then raise exception 'INVALID_REACTION'; end if;
  if not exists (select 1 from public.community_comments where id = p_comment_id and deleted_at is null) then raise exception 'COMMENT_NOT_FOUND'; end if;

  select interaction.type into v_existing_type
  from public.community_comment_interactions interaction
  where interaction.comment_id = p_comment_id and interaction.user_id = v_user_id
  for update;

  if v_existing_type is null then
    insert into public.community_comment_interactions (comment_id, user_id, type)
    values (p_comment_id, v_user_id, p_type)
    on conflict on constraint community_comment_interactions_comment_user_key do update set type = excluded.type;
  elsif v_existing_type = p_type then
    delete from public.community_comment_interactions where community_comment_interactions.comment_id = p_comment_id and user_id = v_user_id;
  else
    update public.community_comment_interactions set type = p_type where community_comment_interactions.comment_id = p_comment_id and user_id = v_user_id;
  end if;

  return query
  select
    p_comment_id,
    count(*) filter (where interaction.type = 'like')::bigint,
    count(*) filter (where interaction.type = 'dislike')::bigint,
    max(interaction.type) filter (where interaction.user_id = v_user_id)::text
  from public.community_comment_interactions interaction
  where interaction.comment_id = p_comment_id;
end;
$function$;

revoke all on public.community_threads, public.community_comments, public.community_comment_interactions from anon, authenticated;
grant select on public.community_threads, public.community_comments, public.community_comment_interactions to anon, authenticated;
grant all on public.community_threads, public.community_comments, public.community_comment_interactions to service_role;

revoke all on function public.assert_community_post_allowed(uuid, text) from public, anon, authenticated;
revoke all on function public.get_community_threads(text, text, integer, integer) from public;
revoke all on function public.get_community_thread(uuid) from public;
revoke all on function public.create_community_thread(text, text, text, varchar) from public;
revoke all on function public.get_community_comments(uuid) from public;
revoke all on function public.create_community_comment(uuid, text, uuid) from public;
revoke all on function public.toggle_community_comment_reaction(uuid, text) from public;

grant execute on function public.get_community_threads(text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_community_thread(uuid) to anon, authenticated;
grant execute on function public.create_community_thread(text, text, text, varchar) to authenticated;
grant execute on function public.get_community_comments(uuid) to anon, authenticated;
grant execute on function public.create_community_comment(uuid, text, uuid) to authenticated;
grant execute on function public.toggle_community_comment_reaction(uuid, text) to authenticated;

commit;
