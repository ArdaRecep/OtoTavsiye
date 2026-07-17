begin;

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

  if not exists (
    select 1
    from public.community_threads thread
    where thread.id = p_thread_id
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
  values (p_thread_id, v_user_id, p_parent_id, trim(p_content))
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

revoke all on function public.create_community_comment(uuid, text, uuid) from public;
grant execute on function public.create_community_comment(uuid, text, uuid) to authenticated;

commit;
