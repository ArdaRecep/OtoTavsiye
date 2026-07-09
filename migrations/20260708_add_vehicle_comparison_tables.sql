-- Karsilastirma sistemi icin ek tablolar.
-- Bu dosya auth migration tekrar calistirilmadan, mevcut veriyi silmeden uygulanabilir.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

create table if not exists public.vehicle_comparisons (
  id uuid primary key default gen_random_uuid(),
  combination_key text not null unique,
  vehicle_count smallint not null check (vehicle_count in (2, 3)),
  status text not null default 'pending' check (status in ('pending', 'generating', 'ready', 'failed', 'stale', 'disabled')),
  ai_result jsonb,
  ai_summary text,
  ai_recommendation text,
  ai_model text,
  prompt_version text not null default 'v1',
  source_hash text,
  requested_by uuid references public.users(id) on delete set null,
  generation_attempts integer not null default 0 check (generation_attempts >= 0),
  generation_started_at timestamptz,
  generated_at timestamptz,
  last_error varchar(1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicle_comparisons_status on public.vehicle_comparisons (status);
create index if not exists idx_vehicle_comparisons_requested_by on public.vehicle_comparisons (requested_by);

create table if not exists public.vehicle_comparison_items (
  comparison_id uuid not null references public.vehicle_comparisons(id) on delete cascade,
  vehicle_id varchar not null references public.vehicle_market_profiles(id) on delete restrict,
  canonical_position smallint not null check (canonical_position in (1, 2, 3)),
  created_at timestamptz not null default now(),
  primary key (comparison_id, vehicle_id),
  constraint vehicle_comparison_items_position_key unique (comparison_id, canonical_position)
);

create index if not exists idx_vehicle_comparison_items_vehicle_id on public.vehicle_comparison_items (vehicle_id);

create table if not exists public.vehicle_comparison_comments (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.vehicle_comparisons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid,
  root_id uuid not null,
  depth smallint not null default 0 check (depth between 0 and 10),
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint vehicle_comparison_comments_comparison_id_id_key unique (comparison_id, id),
  constraint vehicle_comparison_comments_parent_same_comparison_fkey
    foreign key (comparison_id, parent_id)
    references public.vehicle_comparison_comments(comparison_id, id)
    on delete restrict
    deferrable initially immediate,
  constraint vehicle_comparison_comments_root_same_comparison_fkey
    foreign key (comparison_id, root_id)
    references public.vehicle_comparison_comments(comparison_id, id)
    on delete restrict
    deferrable initially immediate
);

create index if not exists idx_vehicle_comparison_comments_comparison_id on public.vehicle_comparison_comments (comparison_id, created_at);
create index if not exists idx_vehicle_comparison_comments_parent_id on public.vehicle_comparison_comments (parent_id);
create index if not exists idx_vehicle_comparison_comments_root_id on public.vehicle_comparison_comments (root_id);
create index if not exists idx_vehicle_comparison_comments_user_id on public.vehicle_comparison_comments (user_id);

create table if not exists public.vehicle_comparison_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null unique references public.vehicle_comparisons(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  last_error varchar(1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicle_comparison_generation_jobs_claim
  on public.vehicle_comparison_generation_jobs (status, available_at, locked_at);

create table if not exists public.vehicle_comparison_ai_reviews (
  id uuid primary key default gen_random_uuid(),
  comparison_id uuid not null references public.vehicle_comparisons(id) on delete cascade,
  provider text not null default 'deepseek',
  model text not null,
  prompt_version text not null default 'v1',
  source_hash text,
  result jsonb,
  summary text,
  recommendation text,
  is_active boolean not null default true,
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_comparison_ai_reviews_provider_check check (btrim(provider) <> ''),
  constraint vehicle_comparison_ai_reviews_model_check check (btrim(model) <> '')
);

create index if not exists idx_vehicle_comparison_ai_reviews_comparison_id
  on public.vehicle_comparison_ai_reviews (comparison_id, generated_at desc);
create unique index if not exists idx_vehicle_comparison_ai_reviews_active_unique
  on public.vehicle_comparison_ai_reviews (comparison_id)
  where is_active;

create or replace function public.normalize_vehicle_comparison_comment()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_parent_depth smallint;
  v_parent_root_id uuid;
begin
  new.body := btrim(coalesce(new.body, ''));

  if char_length(new.body) < 1 or char_length(new.body) > 5000 then
    raise exception 'INVALID_COMPARISON_COMMENT_LENGTH';
  end if;

  if new.parent_id is null then
    new.depth := 0;
    new.root_id := new.id;
  else
    select parent.depth, parent.root_id
    into v_parent_depth, v_parent_root_id
    from public.vehicle_comparison_comments parent
    where parent.comparison_id = new.comparison_id
      and parent.id = new.parent_id;

    if v_parent_depth is null then
      raise exception 'INVALID_COMPARISON_COMMENT_PARENT';
    end if;

    if v_parent_depth >= 10 then
      raise exception 'MAX_COMPARISON_COMMENT_DEPTH_EXCEEDED';
    end if;

    new.depth := v_parent_depth + 1;
    new.root_id := coalesce(v_parent_root_id, new.parent_id);
  end if;

  return new;
end;
$function$;

drop trigger if exists set_vehicle_comparisons_updated_at on public.vehicle_comparisons;
create trigger set_vehicle_comparisons_updated_at
before update on public.vehicle_comparisons
for each row execute function public.set_updated_at();

drop trigger if exists set_vehicle_comparison_comments_updated_at on public.vehicle_comparison_comments;
create trigger set_vehicle_comparison_comments_updated_at
before update on public.vehicle_comparison_comments
for each row execute function public.set_updated_at();

drop trigger if exists normalize_vehicle_comparison_comment_before_insert_update on public.vehicle_comparison_comments;
create trigger normalize_vehicle_comparison_comment_before_insert_update
before insert or update of parent_id, body on public.vehicle_comparison_comments
for each row execute function public.normalize_vehicle_comparison_comment();

drop trigger if exists set_vehicle_comparison_generation_jobs_updated_at on public.vehicle_comparison_generation_jobs;
create trigger set_vehicle_comparison_generation_jobs_updated_at
before update on public.vehicle_comparison_generation_jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_vehicle_comparison_ai_reviews_updated_at on public.vehicle_comparison_ai_reviews;
create trigger set_vehicle_comparison_ai_reviews_updated_at
before update on public.vehicle_comparison_ai_reviews
for each row execute function public.set_updated_at();

alter table public.vehicle_comparisons enable row level security;
alter table public.vehicle_comparison_items enable row level security;
alter table public.vehicle_comparison_comments enable row level security;
alter table public.vehicle_comparison_generation_jobs enable row level security;
alter table public.vehicle_comparison_ai_reviews enable row level security;

drop policy if exists vehicle_comparisons_select_authenticated on public.vehicle_comparisons;
create policy vehicle_comparisons_select_authenticated
on public.vehicle_comparisons
for select
to authenticated
using (true);

drop policy if exists vehicle_comparison_items_select_authenticated on public.vehicle_comparison_items;
create policy vehicle_comparison_items_select_authenticated
on public.vehicle_comparison_items
for select
to authenticated
using (true);

drop policy if exists vehicle_comparison_ai_reviews_select_authenticated on public.vehicle_comparison_ai_reviews;
create policy vehicle_comparison_ai_reviews_select_authenticated
on public.vehicle_comparison_ai_reviews
for select
to authenticated
using (true);

drop policy if exists vehicle_comparison_comments_select_authenticated on public.vehicle_comparison_comments;
create policy vehicle_comparison_comments_select_authenticated
on public.vehicle_comparison_comments
for select
to authenticated
using (true);

drop policy if exists vehicle_comparison_comments_insert_own on public.vehicle_comparison_comments;
create policy vehicle_comparison_comments_insert_own
on public.vehicle_comparison_comments
for insert
to authenticated
with check (auth.uid() = user_id and deleted_at is null);

drop policy if exists vehicle_comparison_comments_update_own_or_admin on public.vehicle_comparison_comments;
create policy vehicle_comparison_comments_update_own_or_admin
on public.vehicle_comparison_comments
for update
to authenticated
using (
  auth.uid() = user_id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
)
with check (
  auth.uid() = user_id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

grant select on table public.vehicle_comparisons to authenticated;
grant select on table public.vehicle_comparison_items to authenticated;
grant select on table public.vehicle_comparison_ai_reviews to authenticated;
grant select, insert on table public.vehicle_comparison_comments to authenticated;
grant update (body, deleted_at) on table public.vehicle_comparison_comments to authenticated;
revoke all on table public.vehicle_comparison_generation_jobs from anon, authenticated;

grant all on table public.vehicle_comparisons to service_role;
grant all on table public.vehicle_comparison_items to service_role;
grant all on table public.vehicle_comparison_comments to service_role;
grant all on table public.vehicle_comparison_generation_jobs to service_role;
grant all on table public.vehicle_comparison_ai_reviews to service_role;

commit;
