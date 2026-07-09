-- Gemini tabanli karsilastirma uretimi icin ek RPC fonksiyonlari.
-- Mevcut DeepSeek fonksiyonlarini silmez; uygulama bu yeni fonksiyonlari kullanir.

begin;

create or replace function public.claim_vehicle_comparison_generation_by_id(
  p_comparison_id uuid,
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
  if p_comparison_id is null then
    raise exception 'COMPARISON_NOT_FOUND';
  end if;

  update public.vehicle_comparison_generation_jobs job
  set
    status = 'processing',
    locked_at = now(),
    attempt_count = job.attempt_count + 1,
    last_error = null
  where job.id = (
    select candidate.id
    from public.vehicle_comparison_generation_jobs candidate
    join public.vehicle_comparisons comparison on comparison.id = candidate.comparison_id
    where candidate.comparison_id = p_comparison_id
      and comparison.status <> 'ready'
      and candidate.status in ('queued', 'failed')
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

create or replace function public.complete_vehicle_comparison_generation_with_provider(
  p_job_id uuid,
  p_result jsonb,
  p_summary text,
  p_recommendation text,
  p_provider text default 'gemini',
  p_model text default 'gemini-2.5-flash-lite',
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
  v_provider text;
  v_model text;
begin
  v_provider := btrim(coalesce(p_provider, 'gemini'));
  v_model := btrim(coalesce(p_model, 'gemini-2.5-flash-lite'));

  if v_provider = '' or v_model = '' then
    raise exception 'INVALID_AI_PROVIDER';
  end if;

  select job.comparison_id
  into v_comparison_id
  from public.vehicle_comparison_generation_jobs job
  where job.id = p_job_id
    and job.status = 'processing'
  for update;

  if v_comparison_id is null then
    raise exception 'JOB_NOT_PROCESSING';
  end if;

  update public.vehicle_comparison_ai_reviews ai
  set is_active = false
  where ai.comparison_id = v_comparison_id
    and ai.is_active;

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
    v_provider,
    v_model,
    btrim(coalesce(p_prompt_version, 'v1')),
    nullif(btrim(coalesce(p_source_hash, '')), ''),
    p_result,
    nullif(btrim(coalesce(p_summary, '')), ''),
    nullif(btrim(coalesce(p_recommendation, '')), ''),
    true
  );

  update public.vehicle_comparisons comparison
  set
    status = 'ready',
    ai_result = p_result,
    ai_summary = nullif(btrim(coalesce(p_summary, '')), ''),
    ai_recommendation = nullif(btrim(coalesce(p_recommendation, '')), ''),
    ai_model = v_model,
    prompt_version = btrim(coalesce(p_prompt_version, 'v1')),
    source_hash = nullif(btrim(coalesce(p_source_hash, '')), ''),
    generated_at = now(),
    last_error = null
  where comparison.id = v_comparison_id;

  update public.vehicle_comparison_generation_jobs job
  set
    status = 'completed',
    completed_at = now(),
    locked_at = null,
    last_error = null
  where job.id = p_job_id;

  comparison_id := v_comparison_id;
  status := 'ready';
  return next;
end;
$function$;

revoke all on function public.claim_vehicle_comparison_generation_by_id(uuid, integer, integer) from public;
revoke all on function public.complete_vehicle_comparison_generation_with_provider(uuid, jsonb, text, text, text, text, text, text) from public;

grant execute on function public.claim_vehicle_comparison_generation_by_id(uuid, integer, integer) to service_role;
grant execute on function public.complete_vehicle_comparison_generation_with_provider(uuid, jsonb, text, text, text, text, text, text) to service_role;

commit;
