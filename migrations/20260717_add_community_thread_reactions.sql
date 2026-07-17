begin;

create table if not exists public.community_thread_interactions (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.community_threads(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  constraint community_thread_interactions_thread_user_key unique (thread_id, user_id)
);

create index if not exists idx_community_thread_interactions_thread
  on public.community_thread_interactions (thread_id);
create index if not exists idx_community_thread_interactions_user
  on public.community_thread_interactions (user_id);

alter table public.community_thread_interactions enable row level security;

drop policy if exists community_thread_interactions_select on public.community_thread_interactions;
create policy community_thread_interactions_select
on public.community_thread_interactions
for select
to anon, authenticated
using (true);

drop policy if exists community_thread_interactions_insert_own on public.community_thread_interactions;
create policy community_thread_interactions_insert_own
on public.community_thread_interactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists community_thread_interactions_update_own on public.community_thread_interactions;
create policy community_thread_interactions_update_own
on public.community_thread_interactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists community_thread_interactions_delete_own on public.community_thread_interactions;
create policy community_thread_interactions_delete_own
on public.community_thread_interactions
for delete
to authenticated
using (auth.uid() = user_id);

drop function if exists public.get_community_threads(text, text, integer, integer);
drop function if exists public.get_community_threads(text, text, integer, integer, text);
create function public.get_community_threads(
  p_category text default null,
  p_search text default null,
  p_page integer default 0,
  p_page_size integer default 20,
  p_sort text default 'newest'
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
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text,
  total_count bigint
)
language sql
stable
security definer
set search_path = ''
as $function$
  with filtered_threads as (
    select
      thread.*,
      coalesce(author.username, 'Kullanıcı')::text as author_username,
      vehicle.make::text as vehicle_make,
      vehicle.model::text as vehicle_model
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
  )
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
    thread.author_username,
    (
      select count(*)
      from public.community_comments comment
      where comment.thread_id = thread.id and comment.deleted_at is null
    )::bigint as comment_count,
    (
      select count(distinct participant.user_id)
      from (
        select thread.user_id
        union all
        select comment.user_id
        from public.community_comments comment
        where comment.thread_id = thread.id and comment.deleted_at is null
      ) participant
    )::bigint as participant_count,
    thread.vehicle_make,
    thread.vehicle_model,
    thread.image_paths,
    count(interaction.id) filter (where interaction.type = 'like')::bigint as like_count,
    count(interaction.id) filter (where interaction.type = 'dislike')::bigint as dislike_count,
    max(interaction.type) filter (where interaction.user_id = auth.uid())::text as current_user_reaction,
    count(*) over()::bigint as total_count
  from filtered_threads thread
  left join public.community_thread_interactions interaction on interaction.thread_id = thread.id
  group by thread.id, thread.title, thread.body, thread.category, thread.vehicle_id, thread.status,
    thread.created_at, thread.updated_at, thread.user_id, thread.author_username,
    thread.vehicle_make, thread.vehicle_model, thread.image_paths
  order by
    case when coalesce(p_sort, 'newest') = 'popular'
      then (count(interaction.id) filter (where interaction.type = 'like') - count(interaction.id) filter (where interaction.type = 'dislike'))
      else null
    end desc nulls last,
    case when coalesce(p_sort, 'newest') = 'popular'
      then count(interaction.id) filter (where interaction.type = 'like')
      else null
    end desc nulls last,
    thread.created_at desc
  limit least(greatest(coalesce(p_page_size, 20), 10), 40)
  offset greatest(coalesce(p_page, 0), 0) * least(greatest(coalesce(p_page_size, 20), 10), 40);
$function$;

create or replace function public.get_community_thread_social_state(p_thread_ids uuid[])
returns table (
  thread_id uuid,
  like_count bigint,
  dislike_count bigint,
  current_user_reaction text
)
language sql
stable
security definer
set search_path = ''
as $function$
  select
    thread.id,
    count(interaction.id) filter (where interaction.type = 'like')::bigint,
    count(interaction.id) filter (where interaction.type = 'dislike')::bigint,
    max(interaction.type) filter (where interaction.user_id = auth.uid())::text
  from public.community_threads thread
  left join public.community_thread_interactions interaction on interaction.thread_id = thread.id
  where thread.id = any(coalesce(p_thread_ids, '{}'::uuid[]))
  group by thread.id;
$function$;

create or replace function public.toggle_community_thread_reaction(p_thread_id uuid, p_type text)
returns table (
  thread_id uuid,
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
  if not exists (select 1 from public.community_threads thread where thread.id = p_thread_id) then
    raise exception 'THREAD_NOT_FOUND';
  end if;

  select interaction.type into v_existing_type
  from public.community_thread_interactions interaction
  where interaction.thread_id = p_thread_id and interaction.user_id = v_user_id
  for update;

  if v_existing_type = p_type then
    delete from public.community_thread_interactions interaction
    where interaction.thread_id = p_thread_id and interaction.user_id = v_user_id;
  elsif v_existing_type is null then
    insert into public.community_thread_interactions (thread_id, user_id, type)
    values (p_thread_id, v_user_id, p_type);
  else
    update public.community_thread_interactions interaction
    set type = p_type
    where interaction.thread_id = p_thread_id and interaction.user_id = v_user_id;
  end if;

  return query
  select *
  from public.get_community_thread_social_state(array[p_thread_id]);
end;
$function$;

revoke all on function public.get_community_threads(text, text, integer, integer, text) from public;
revoke all on function public.get_community_thread_social_state(uuid[]) from public;
revoke all on function public.toggle_community_thread_reaction(uuid, text) from public;

grant execute on function public.get_community_threads(text, text, integer, integer, text) to anon, authenticated;
grant execute on function public.get_community_thread_social_state(uuid[]) to anon, authenticated;
grant execute on function public.toggle_community_thread_reaction(uuid, text) to authenticated;

commit;
