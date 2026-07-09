-- Karsilastirma RPC fonksiyonlari.
-- Tablolar olustuktan sonra calistirilir; mevcut veriyi silmez.

begin;

create or replace function public.ensure_vehicle_comparison(p_vehicle_ids varchar[])
returns table (
  comparison_id uuid,
  combination_key text,
  vehicle_count smallint,
  status text,
  job_id uuid
)
language plpgsql
security definer
set search_path = ''
as $function$
#variable_conflict use_column
declare
  v_user_id uuid;
  v_vehicle_ids varchar[];
  v_vehicle_count smallint;
  v_existing_vehicle_count integer;
  v_comparison_id uuid;
  v_combination_key text;
  v_status text;
  v_job_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select array_agg(vehicle_id order by vehicle_id)
  into v_vehicle_ids
  from (
    select distinct btrim(value)::varchar as vehicle_id
    from unnest(coalesce(p_vehicle_ids, array[]::varchar[])) as value
    where btrim(value) <> ''
  ) normalized;

  v_vehicle_count := coalesce(array_length(v_vehicle_ids, 1), 0)::smallint;
  if v_vehicle_count not in (2, 3) then
    raise exception 'INVALID_VEHICLE_COUNT';
  end if;

  select count(*)
  into v_existing_vehicle_count
  from public.vehicle_market_profiles vehicle
  where vehicle.id = any(v_vehicle_ids);

  if v_existing_vehicle_count <> v_vehicle_count then
    raise exception 'VEHICLE_NOT_FOUND';
  end if;

  v_combination_key := array_to_string(v_vehicle_ids, ':');

  insert into public.vehicle_comparisons as vc (
    combination_key,
    vehicle_count,
    requested_by,
    status
  )
  values (
    v_combination_key,
    v_vehicle_count,
    v_user_id,
    'pending'
  )
  on conflict (combination_key) do update
  set updated_at = vc.updated_at
  returning vc.id, vc.status
  into v_comparison_id, v_status;

  insert into public.vehicle_comparison_items (
    comparison_id,
    vehicle_id,
    canonical_position
  )
  select
    v_comparison_id,
    item.vehicle_id,
    item.position::smallint
  from unnest(v_vehicle_ids) with ordinality as item(vehicle_id, position)
  on conflict do nothing;

  if v_status in ('pending', 'failed', 'stale') then
    update public.vehicle_comparisons
    set
      status = 'pending',
      requested_by = coalesce(requested_by, v_user_id),
      last_error = null
    where id = v_comparison_id
    returning public.vehicle_comparisons.status into v_status;

    insert into public.vehicle_comparison_generation_jobs (
      comparison_id,
      status,
      available_at
    )
    values (
      v_comparison_id,
      'queued',
      now()
    )
    on conflict (comparison_id) do update
    set
      status = case
        when public.vehicle_comparison_generation_jobs.status = 'completed' then 'completed'
        when public.vehicle_comparison_generation_jobs.status = 'processing' then 'processing'
        else 'queued'
      end,
      available_at = case
        when public.vehicle_comparison_generation_jobs.status in ('completed', 'processing')
          then public.vehicle_comparison_generation_jobs.available_at
        else now()
      end,
      last_error = null
    returning id into v_job_id;
  else
    select id
    into v_job_id
    from public.vehicle_comparison_generation_jobs
    where comparison_id = v_comparison_id;
  end if;

  comparison_id := v_comparison_id;
  combination_key := v_combination_key;
  vehicle_count := v_vehicle_count;
  status := v_status;
  job_id := v_job_id;
  return next;
end;
$function$;

create or replace function public.get_vehicle_comparison_detail(p_comparison_id uuid)
returns table (
  comparison_id uuid,
  combination_key text,
  vehicle_count smallint,
  status text,
  ai_result jsonb,
  ai_summary text,
  ai_recommendation text,
  ai_model text,
  prompt_version text,
  source_hash text,
  generation_attempts integer,
  generation_started_at timestamptz,
  generated_at timestamptz,
  last_error text,
  created_at timestamptz,
  updated_at timestamptz,
  vehicles jsonb,
  active_ai_review jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  return query
  select
    comparison.id,
    comparison.combination_key,
    comparison.vehicle_count,
    comparison.status,
    comparison.ai_result,
    comparison.ai_summary,
    comparison.ai_recommendation,
    comparison.ai_model,
    comparison.prompt_version,
    comparison.source_hash,
    comparison.generation_attempts,
    comparison.generation_started_at,
    comparison.generated_at,
    comparison.last_error::text,
    comparison.created_at,
    comparison.updated_at,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', vehicle.id,
            'make', vehicle.make,
            'model', vehicle.model,
            'trimLevel', vehicle.trim_level,
            'segment', vehicle.segment,
            'bodyType', vehicle.body_type,
            'fuelType', vehicle.fuel_type,
            'transmission', vehicle.transmission,
            'minSeats', vehicle.min_seats,
            'powerHp', vehicle.power_hp,
            'minYear', vehicle.min_year,
            'maxYear', vehicle.max_year,
            'minKm', vehicle.min_km,
            'maxKm', vehicle.max_km,
            'marketMinPrice', vehicle.market_min_price,
            'marketMaxPrice', vehicle.market_max_price,
            'avgAnnualCostTry', vehicle.avg_annual_cost_try,
            'conditionSummary', vehicle.condition_summary,
            'imageUrl', vehicle.image_url,
            'tags', vehicle.tags,
            'whyListed', vehicle.why_listed,
            'pros', vehicle.pros,
            'cons', vehicle.cons,
            'canonicalPosition', item.canonical_position
          )
          order by item.canonical_position
        )
        from public.vehicle_comparison_items item
        join public.vehicle_market_profiles vehicle on vehicle.id = item.vehicle_id
        where item.comparison_id = comparison.id
      ),
      '[]'::jsonb
    ) as vehicles,
    (
      select to_jsonb(review)
      from (
        select
          ai.id,
          ai.provider,
          ai.model,
          ai.prompt_version as "promptVersion",
          ai.source_hash as "sourceHash",
          ai.result,
          ai.summary,
          ai.recommendation,
          ai.generated_at as "generatedAt"
        from public.vehicle_comparison_ai_reviews ai
        where ai.comparison_id = comparison.id
          and ai.is_active
        order by ai.generated_at desc
        limit 1
      ) review
    ) as active_ai_review
  from public.vehicle_comparisons comparison
  where comparison.id = p_comparison_id;
end;
$function$;

create or replace function public.claim_vehicle_comparison_generation(
  p_worker_id text default null,
  p_lock_timeout_seconds integer default 300,
  p_max_attempts integer default 3
)
returns table (
  job_id uuid,
  comparison_id uuid,
  combination_key text,
  vehicle_count smallint,
  attempt_count integer,
  vehicles jsonb
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_job_id uuid;
begin
  update public.vehicle_comparison_generation_jobs job
  set
    status = 'processing',
    locked_at = now(),
    attempt_count = job.attempt_count + 1,
    last_error = null
  where job.id = (
    select candidate.id
    from public.vehicle_comparison_generation_jobs candidate
    where candidate.status in ('queued', 'failed')
      and candidate.attempt_count < p_max_attempts
      and candidate.available_at <= now()
      and (
        candidate.locked_at is null
        or candidate.locked_at < now() - make_interval(secs => greatest(1, p_lock_timeout_seconds))
      )
    order by candidate.available_at asc, candidate.created_at asc
    for update skip locked
    limit 1
  )
  returning job.id into v_job_id;

  if v_job_id is null then
    return;
  end if;

  update public.vehicle_comparisons comparison
  set
    status = 'generating',
    generation_started_at = now(),
    generation_attempts = greatest(comparison.generation_attempts, job.attempt_count),
    last_error = null
  from public.vehicle_comparison_generation_jobs job
  where comparison.id = job.comparison_id
    and job.id = v_job_id;

  return query
  select
    job.id,
    comparison.id,
    comparison.combination_key,
    comparison.vehicle_count,
    job.attempt_count,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', vehicle.id,
            'make', vehicle.make,
            'model', vehicle.model,
            'trimLevel', vehicle.trim_level,
            'segment', vehicle.segment,
            'bodyType', vehicle.body_type,
            'fuelType', vehicle.fuel_type,
            'transmission', vehicle.transmission,
            'minSeats', vehicle.min_seats,
            'powerHp', vehicle.power_hp,
            'minYear', vehicle.min_year,
            'maxYear', vehicle.max_year,
            'minKm', vehicle.min_km,
            'maxKm', vehicle.max_km,
            'marketMinPrice', vehicle.market_min_price,
            'marketMaxPrice', vehicle.market_max_price,
            'avgAnnualCostTry', vehicle.avg_annual_cost_try,
            'conditionSummary', vehicle.condition_summary,
            'tags', vehicle.tags,
            'whyListed', vehicle.why_listed,
            'pros', vehicle.pros,
            'cons', vehicle.cons,
            'canonicalPosition', item.canonical_position
          )
          order by item.canonical_position
        )
        from public.vehicle_comparison_items item
        join public.vehicle_market_profiles vehicle on vehicle.id = item.vehicle_id
        where item.comparison_id = comparison.id
      ),
      '[]'::jsonb
    )
  from public.vehicle_comparison_generation_jobs job
  join public.vehicle_comparisons comparison on comparison.id = job.comparison_id
  where job.id = v_job_id;
end;
$function$;

create or replace function public.complete_vehicle_comparison_generation(
  p_job_id uuid,
  p_result jsonb,
  p_summary text,
  p_recommendation text,
  p_model text,
  p_prompt_version text default 'v1',
  p_source_hash text default null
)
returns table (
  comparison_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_comparison_id uuid;
begin
  select job.comparison_id
  into v_comparison_id
  from public.vehicle_comparison_generation_jobs job
  where job.id = p_job_id
    and job.status = 'processing'
  for update;

  if v_comparison_id is null then
    raise exception 'JOB_NOT_PROCESSING';
  end if;

  update public.vehicle_comparison_ai_reviews
  set is_active = false
  where comparison_id = v_comparison_id
    and is_active;

  insert into public.vehicle_comparison_ai_reviews (
    comparison_id,
    provider,
    model,
    prompt_version,
    source_hash,
    result,
    summary,
    recommendation,
    is_active
  )
  values (
    v_comparison_id,
    'deepseek',
    btrim(coalesce(p_model, 'deepseek')),
    btrim(coalesce(p_prompt_version, 'v1')),
    nullif(btrim(coalesce(p_source_hash, '')), ''),
    p_result,
    nullif(btrim(coalesce(p_summary, '')), ''),
    nullif(btrim(coalesce(p_recommendation, '')), ''),
    true
  );

  update public.vehicle_comparisons
  set
    status = 'ready',
    ai_result = p_result,
    ai_summary = nullif(btrim(coalesce(p_summary, '')), ''),
    ai_recommendation = nullif(btrim(coalesce(p_recommendation, '')), ''),
    ai_model = btrim(coalesce(p_model, 'deepseek')),
    prompt_version = btrim(coalesce(p_prompt_version, 'v1')),
    source_hash = nullif(btrim(coalesce(p_source_hash, '')), ''),
    generated_at = now(),
    last_error = null
  where id = v_comparison_id;

  update public.vehicle_comparison_generation_jobs
  set
    status = 'completed',
    completed_at = now(),
    locked_at = null,
    last_error = null
  where id = p_job_id;

  comparison_id := v_comparison_id;
  status := 'ready';
  return next;
end;
$function$;

create or replace function public.fail_vehicle_comparison_generation(
  p_job_id uuid,
  p_error text,
  p_retry_after_seconds integer default 60,
  p_max_attempts integer default 3
)
returns table (
  comparison_id uuid,
  job_status text,
  comparison_status text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_comparison_id uuid;
  v_attempt_count integer;
  v_job_status text;
  v_comparison_status text;
  v_error varchar(1000);
begin
  v_error := left(coalesce(nullif(btrim(p_error), ''), 'GENERATION_FAILED'), 1000);

  select job.comparison_id, job.attempt_count
  into v_comparison_id, v_attempt_count
  from public.vehicle_comparison_generation_jobs job
  where job.id = p_job_id
  for update;

  if v_comparison_id is null then
    raise exception 'JOB_NOT_FOUND';
  end if;

  if v_attempt_count < p_max_attempts then
    v_job_status := 'queued';
    v_comparison_status := 'pending';
  else
    v_job_status := 'failed';
    v_comparison_status := 'failed';
  end if;

  update public.vehicle_comparison_generation_jobs
  set
    status = v_job_status,
    available_at = now() + make_interval(secs => greatest(1, p_retry_after_seconds)),
    locked_at = null,
    last_error = v_error
  where id = p_job_id;

  update public.vehicle_comparisons
  set
    status = v_comparison_status,
    last_error = v_error
  where id = v_comparison_id;

  comparison_id := v_comparison_id;
  job_status := v_job_status;
  comparison_status := v_comparison_status;
  return next;
end;
$function$;

create or replace function public.requeue_stale_vehicle_comparison(
  p_lock_timeout_seconds integer default 600
)
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_count integer;
begin
  update public.vehicle_comparison_generation_jobs job
  set
    status = 'queued',
    locked_at = null,
    available_at = now()
  where job.status = 'processing'
    and job.locked_at < now() - make_interval(secs => greatest(1, p_lock_timeout_seconds));

  get diagnostics v_count = row_count;

  update public.vehicle_comparisons comparison
  set status = 'pending'
  where comparison.status = 'generating'
    and exists (
      select 1
      from public.vehicle_comparison_generation_jobs job
      where job.comparison_id = comparison.id
        and job.status = 'queued'
    );

  return v_count;
end;
$function$;

create or replace function public.create_vehicle_comparison_comment(
  p_comparison_id uuid,
  p_body text,
  p_parent_id uuid default null
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
  author_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_comment_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (select 1 from public.vehicle_comparisons where vehicle_comparisons.id = p_comparison_id) then
    raise exception 'COMPARISON_NOT_FOUND';
  end if;

  if p_parent_id is not null and not exists (
    select 1
    from public.vehicle_comparison_comments parent
    where parent.comparison_id = p_comparison_id
      and parent.id = p_parent_id
  ) then
    raise exception 'INVALID_COMPARISON_COMMENT_PARENT';
  end if;

  v_comment_id := gen_random_uuid();

  insert into public.vehicle_comparison_comments (
    id,
    comparison_id,
    user_id,
    parent_id,
    root_id,
    body
  )
  values (
    v_comment_id,
    p_comparison_id,
    v_user_id,
    p_parent_id,
    v_comment_id,
    p_body
  )
  returning vehicle_comparison_comments.id into v_comment_id;

  return query
  select comments.*
  from public.get_vehicle_comparison_comment_threads(p_comparison_id) comments
  where comments.id = v_comment_id;
end;
$function$;

create or replace function public.update_vehicle_comparison_comment(
  p_comment_id uuid,
  p_body text
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
  author_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid;
  v_comparison_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select comment.comparison_id
  into v_comparison_id
  from public.vehicle_comparison_comments comment
  where comment.id = p_comment_id
    and comment.deleted_at is null
    and (
      comment.user_id = v_user_id
      or exists (select 1 from public.users u where u.id = v_user_id and u.is_admin)
    )
  for update;

  if v_comparison_id is null then
    raise exception 'COMMENT_NOT_FOUND';
  end if;

  update public.vehicle_comparison_comments
  set body = p_body
  where vehicle_comparison_comments.id = p_comment_id;

  return query
  select comments.*
  from public.get_vehicle_comparison_comment_threads(v_comparison_id) comments
  where comments.id = p_comment_id;
end;
$function$;

create or replace function public.delete_vehicle_comparison_comment(p_comment_id uuid)
returns table (
  id uuid,
  comparison_id uuid,
  deleted_at timestamptz
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

  update public.vehicle_comparison_comments comment
  set
    deleted_at = coalesce(comment.deleted_at, now()),
    body = '[silindi]'
  where comment.id = p_comment_id
    and (
      comment.user_id = v_user_id
      or exists (select 1 from public.users u where u.id = v_user_id and u.is_admin)
    )
  returning comment.id, comment.comparison_id, comment.deleted_at
  into id, comparison_id, deleted_at;

  if id is null then
    raise exception 'COMMENT_NOT_FOUND';
  end if;

  return next;
end;
$function$;

create or replace function public.get_vehicle_comparison_comment_threads(
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
  author_avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null then
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
    profile.avatar_url::text as author_avatar_url
  from public.vehicle_comparison_comments comment
  left join public.users profile on profile.id = comment.user_id
  where comment.comparison_id = p_comparison_id
  order by
    comment.root_id asc,
    comment.depth asc,
    comment.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 300)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$function$;

revoke all on function public.ensure_vehicle_comparison(varchar[]) from public;
revoke all on function public.get_vehicle_comparison_detail(uuid) from public;
revoke all on function public.claim_vehicle_comparison_generation(text, integer, integer) from public;
revoke all on function public.complete_vehicle_comparison_generation(uuid, jsonb, text, text, text, text, text) from public;
revoke all on function public.fail_vehicle_comparison_generation(uuid, text, integer, integer) from public;
revoke all on function public.requeue_stale_vehicle_comparison(integer) from public;
revoke all on function public.create_vehicle_comparison_comment(uuid, text, uuid) from public;
revoke all on function public.update_vehicle_comparison_comment(uuid, text) from public;
revoke all on function public.delete_vehicle_comparison_comment(uuid) from public;
revoke all on function public.get_vehicle_comparison_comment_threads(uuid, integer, integer) from public;

grant execute on function public.ensure_vehicle_comparison(varchar[]) to authenticated, service_role;
grant execute on function public.get_vehicle_comparison_detail(uuid) to authenticated, service_role;
grant execute on function public.create_vehicle_comparison_comment(uuid, text, uuid) to authenticated, service_role;
grant execute on function public.update_vehicle_comparison_comment(uuid, text) to authenticated, service_role;
grant execute on function public.delete_vehicle_comparison_comment(uuid) to authenticated, service_role;
grant execute on function public.get_vehicle_comparison_comment_threads(uuid, integer, integer) to authenticated, service_role;
grant execute on function public.claim_vehicle_comparison_generation(text, integer, integer) to service_role;
grant execute on function public.complete_vehicle_comparison_generation(uuid, jsonb, text, text, text, text, text) to service_role;
grant execute on function public.fail_vehicle_comparison_generation(uuid, text, integer, integer) to service_role;
grant execute on function public.requeue_stale_vehicle_comparison(integer) to service_role;

commit;
