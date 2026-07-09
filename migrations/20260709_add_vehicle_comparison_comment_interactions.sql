-- Karsilastirma yorumlarini arac yorumlariyla ayni etkilesim modeline yaklastirir.
-- Mevcut yorum verisini silmez.

begin;

create table if not exists public.vehicle_comparison_comment_interactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.vehicle_comparison_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  constraint vehicle_comparison_comment_interactions_comment_user_key unique (comment_id, user_id)
);

create index if not exists idx_vehicle_comparison_comment_interactions_comment_id
  on public.vehicle_comparison_comment_interactions (comment_id);
create index if not exists idx_vehicle_comparison_comment_interactions_user_id
  on public.vehicle_comparison_comment_interactions (user_id);

alter table public.vehicle_comparison_comment_interactions enable row level security;

drop policy if exists vehicle_comparison_comment_interactions_select_authenticated
  on public.vehicle_comparison_comment_interactions;
create policy vehicle_comparison_comment_interactions_select_authenticated
on public.vehicle_comparison_comment_interactions
for select
to authenticated
using (true);

drop policy if exists vehicle_comparison_comment_interactions_insert_own
  on public.vehicle_comparison_comment_interactions;
create policy vehicle_comparison_comment_interactions_insert_own
on public.vehicle_comparison_comment_interactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists vehicle_comparison_comment_interactions_update_own
  on public.vehicle_comparison_comment_interactions;
create policy vehicle_comparison_comment_interactions_update_own
on public.vehicle_comparison_comment_interactions
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists vehicle_comparison_comment_interactions_delete_own
  on public.vehicle_comparison_comment_interactions;
create policy vehicle_comparison_comment_interactions_delete_own
on public.vehicle_comparison_comment_interactions
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.toggle_vehicle_comparison_comment_reaction(
  p_comment_id uuid,
  p_type text
)
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
  v_user_id uuid;
  v_existing_type text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_type not in ('like', 'dislike') then
    raise exception 'INVALID_COMPARISON_COMMENT_REACTION_TYPE';
  end if;

  if not exists (
    select 1
    from public.vehicle_comparison_comments comment
    where comment.id = p_comment_id
      and comment.deleted_at is null
  ) then
    raise exception 'COMMENT_NOT_FOUND';
  end if;

  select interaction.type
  into v_existing_type
  from public.vehicle_comparison_comment_interactions interaction
  where interaction.comment_id = p_comment_id
    and interaction.user_id = v_user_id
  for update;

  if v_existing_type is null then
    insert into public.vehicle_comparison_comment_interactions (comment_id, user_id, type)
    values (p_comment_id, v_user_id, p_type)
    on conflict on constraint vehicle_comparison_comment_interactions_comment_user_key
    do update set type = excluded.type;
  elsif v_existing_type = p_type then
    delete from public.vehicle_comparison_comment_interactions interaction
    where interaction.comment_id = p_comment_id
      and interaction.user_id = v_user_id;
  else
    update public.vehicle_comparison_comment_interactions interaction
    set type = p_type
    where interaction.comment_id = p_comment_id
      and interaction.user_id = v_user_id;
  end if;

  return query
  select
    p_comment_id,
    count(*) filter (where interaction.type = 'like')::bigint,
    count(*) filter (where interaction.type = 'dislike')::bigint,
    (
      select current_interaction.type
      from public.vehicle_comparison_comment_interactions current_interaction
      where current_interaction.comment_id = p_comment_id
        and current_interaction.user_id = v_user_id
      limit 1
    )::text
  from public.vehicle_comparison_comment_interactions interaction
  where interaction.comment_id = p_comment_id;
end;
$function$;

create or replace function public.get_vehicle_comparison_comments_with_reactions(
  p_comparison_id uuid,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  id uuid,
  comparison_id uuid,
  parent_id uuid,
  root_id uuid,
  user_id uuid,
  body text,
  depth smallint,
  created_at timestamptz,
  updated_at timestamptz,
  deleted_at timestamptz,
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
set search_path = ''
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return query
  select
    comment.id,
    comment.comparison_id,
    comment.parent_id,
    comment.root_id,
    comment.user_id,
    case when comment.deleted_at is null then comment.body else '[silindi]' end as body,
    comment.depth,
    comment.created_at,
    comment.updated_at,
    comment.deleted_at,
    coalesce(profile.username, 'Kullanıcı')::text as author_username,
    profile.avatar_url::text as author_avatar_url,
    count(interaction.id) filter (where interaction.type = 'like')::bigint as like_count,
    count(interaction.id) filter (where interaction.type = 'dislike')::bigint as dislike_count,
    max(interaction.type) filter (where interaction.user_id = v_user_id)::text as current_user_reaction,
    (
      select count(*)
      from public.vehicle_comparison_comments child
      where child.parent_id = comment.id
        and child.deleted_at is null
    )::bigint as reply_count,
    null::numeric as author_car_rating
  from public.vehicle_comparison_comments comment
  left join public.users profile on profile.id = comment.user_id
  left join public.vehicle_comparison_comment_interactions interaction on interaction.comment_id = comment.id
  where comment.comparison_id = p_comparison_id
  group by
    comment.id,
    comment.comparison_id,
    comment.parent_id,
    comment.root_id,
    comment.user_id,
    comment.body,
    comment.depth,
    comment.created_at,
    comment.updated_at,
    comment.deleted_at,
    profile.username,
    profile.avatar_url
  order by
    comment.root_id asc,
    comment.depth asc,
    comment.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 300)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

grant select on table public.vehicle_comparison_comment_interactions to authenticated;
grant insert, update, delete on table public.vehicle_comparison_comment_interactions to authenticated;
grant all on table public.vehicle_comparison_comment_interactions to service_role;

revoke all on function public.toggle_vehicle_comparison_comment_reaction(uuid, text) from public;
revoke all on function public.get_vehicle_comparison_comments_with_reactions(uuid, integer, integer) from public;
grant execute on function public.toggle_vehicle_comparison_comment_reaction(uuid, text) to authenticated, service_role;
grant execute on function public.get_vehicle_comparison_comments_with_reactions(uuid, integer, integer) to authenticated, service_role;

commit;
