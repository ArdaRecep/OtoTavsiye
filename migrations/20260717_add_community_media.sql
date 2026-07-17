begin;

alter table public.community_threads
  add column if not exists image_paths text[] not null default '{}'::text[];

alter table public.community_comments
  add column if not exists image_paths text[] not null default '{}'::text[];

alter table public.community_threads
  drop constraint if exists community_threads_image_paths_check;
alter table public.community_threads
  add constraint community_threads_image_paths_check
  check (cardinality(image_paths) between 0 and 3);

alter table public.community_comments
  drop constraint if exists community_comments_image_paths_check;
alter table public.community_comments
  add constraint community_comments_image_paths_check
  check (cardinality(image_paths) = 0);

alter table public.community_comments
  drop constraint if exists community_comments_content_check;
alter table public.community_comments
  add constraint community_comments_content_check
  check (char_length(trim(content)) between 1 and 1000);

create unique index if not exists community_threads_one_open_per_user_idx
on public.community_threads (user_id)
where status = 'open';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-images',
  'community-images',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists community_images_public_read on storage.objects;
create policy community_images_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'community-images');

create or replace function public.validate_community_image_paths(
  p_user_id uuid,
  p_image_paths text[]
)
returns text[]
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_paths text[] := coalesce(p_image_paths, '{}'::text[]);
begin
  if cardinality(v_paths) > 3 then
    raise exception 'TOO_MANY_IMAGES';
  end if;

  if cardinality(v_paths) <> (
    select count(distinct image_path)::integer
    from unnest(v_paths) as image_path
  ) then
    raise exception 'DUPLICATE_IMAGE';
  end if;

  if exists (
    select 1
    from unnest(v_paths) as image_path
    where image_path is null
      or split_part(image_path, '/', 1) <> p_user_id::text
      or lower(image_path) !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$'
  ) then
    raise exception 'INVALID_IMAGE_PATH';
  end if;

  return v_paths;
end;
$function$;

drop function if exists public.get_community_threads(text, text, integer, integer);
create function public.get_community_threads(
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
  image_paths text[],
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
      select count(*)
      from public.community_comments comment
      where comment.thread_id = thread.id and comment.deleted_at is null
    )::bigint,
    (
      select count(distinct participant.user_id)
      from (
        select thread.user_id
        union all
        select comment.user_id
        from public.community_comments comment
        where comment.thread_id = thread.id and comment.deleted_at is null
      ) participant
    )::bigint,
    vehicle.make::text,
    vehicle.model::text,
    thread.image_paths,
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

drop function if exists public.get_community_thread(uuid);
create function public.get_community_thread(p_thread_id uuid)
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
  image_paths text[]
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
      select count(*)
      from public.community_comments comment
      where comment.thread_id = thread.id and comment.deleted_at is null
    )::bigint,
    (
      select count(distinct participant.user_id)
      from (
        select thread.user_id
        union all
        select comment.user_id
        from public.community_comments comment
        where comment.thread_id = thread.id and comment.deleted_at is null
      ) participant
    )::bigint,
    vehicle.make::text,
    vehicle.model::text,
    thread.image_paths
  from public.community_threads thread
  left join public.users author on author.id = thread.user_id
  left join public.vehicle_market_profiles vehicle on vehicle.id = thread.vehicle_id
  where thread.id = p_thread_id;
$function$;

drop function if exists public.create_community_thread(text, text, text, varchar);
drop function if exists public.create_community_thread(text, text, text, varchar, text[]);
create function public.create_community_thread(
  p_title text,
  p_body text,
  p_category text,
  p_vehicle_id varchar default null,
  p_image_paths text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_thread_id uuid;
  v_image_paths text[];
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if char_length(trim(coalesce(p_title, ''))) not between 5 and 120 then raise exception 'INVALID_TITLE'; end if;
  if char_length(trim(coalesce(p_body, ''))) not between 10 and 3000 then raise exception 'INVALID_BODY'; end if;
  if p_category not in ('vehicle_advice', 'ownership', 'technical', 'general') then raise exception 'INVALID_CATEGORY'; end if;

  v_image_paths := public.validate_community_image_paths(v_user_id, p_image_paths);
  perform public.assert_community_post_allowed(v_user_id, p_title || ' ' || p_body);

  if exists (
    select 1
    from public.community_threads thread
    where thread.user_id = v_user_id
      and thread.status = 'open'
  ) then raise exception 'ACTIVE_THREAD_EXISTS'; end if;

  if p_vehicle_id is not null and not exists (
    select 1 from public.vehicle_market_profiles vehicle where vehicle.id = p_vehicle_id
  ) then raise exception 'VEHICLE_NOT_FOUND'; end if;

  if exists (
    select 1
    from public.community_threads thread
    where thread.user_id = v_user_id
      and thread.created_at > now() - interval '30 seconds'
  ) then raise exception 'RATE_LIMIT'; end if;

  insert into public.community_threads (user_id, title, body, category, vehicle_id, image_paths)
  values (v_user_id, trim(p_title), trim(p_body), p_category, p_vehicle_id, v_image_paths)
  returning id into v_thread_id;

  return v_thread_id;
end;
$function$;

drop function if exists public.get_community_comments(uuid);
create function public.get_community_comments(p_thread_id uuid)
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
    (
      select count(*)
      from public.community_comments child
      where child.parent_id = comment.id and child.deleted_at is null
    )::bigint
  from public.community_comments comment
  left join public.users author on author.id = comment.user_id
  left join public.community_comment_interactions interaction on interaction.comment_id = comment.id
  where comment.thread_id = p_thread_id
  group by comment.id, author.username, author.avatar_url
  order by comment.created_at asc;
$function$;

drop function if exists public.create_community_comment(uuid, text, uuid);
drop function if exists public.create_community_comment(uuid, text, uuid, text[]);
create function public.create_community_comment(
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
  v_content text := trim(coalesce(p_content, ''));
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;

  if char_length(v_content) not between 1 and 1000 then
    raise exception 'INVALID_CONTENT';
  end if;

  perform public.assert_community_post_allowed(v_user_id, v_content);

  if not exists (
    select 1 from public.community_threads thread where thread.id = p_thread_id
  ) then raise exception 'THREAD_NOT_FOUND'; end if;

  if exists (
    select 1
    from public.community_threads thread
    where thread.id = p_thread_id and thread.status = 'closed'
  ) then raise exception 'THREAD_CLOSED'; end if;

  if p_parent_id is not null and not exists (
    select 1
    from public.community_comments parent
    where parent.id = p_parent_id and parent.thread_id = p_thread_id
  ) then raise exception 'INVALID_PARENT'; end if;

  if exists (
    select 1
    from public.community_comments recent_comment
    where recent_comment.user_id = v_user_id
      and recent_comment.created_at > now() - interval '5 seconds'
  ) then raise exception 'RATE_LIMIT'; end if;

  insert into public.community_comments (thread_id, user_id, parent_id, content)
  values (p_thread_id, v_user_id, p_parent_id, v_content)
  returning * into v_comment;

  update public.community_threads thread
  set updated_at = now()
  where thread.id = p_thread_id;

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

revoke all on function public.validate_community_image_paths(uuid, text[]) from public, anon, authenticated;
revoke all on function public.get_community_threads(text, text, integer, integer) from public;
revoke all on function public.get_community_thread(uuid) from public;
revoke all on function public.create_community_thread(text, text, text, varchar, text[]) from public;
revoke all on function public.get_community_comments(uuid) from public;
revoke all on function public.create_community_comment(uuid, text, uuid) from public;

grant execute on function public.get_community_threads(text, text, integer, integer) to anon, authenticated;
grant execute on function public.get_community_thread(uuid) to anon, authenticated;
grant execute on function public.create_community_thread(text, text, text, varchar, text[]) to authenticated;
grant execute on function public.get_community_comments(uuid) to anon, authenticated;
grant execute on function public.create_community_comment(uuid, text, uuid) to authenticated;

commit;
