-- Supabase Auth gecisi.
-- Varsayim: proje gelistirme asamasindadir; eski local-auth test kullanicilari korunmak zorunda degildir.
-- Bu migration public.users tablosunu auth.users profil tablosuna donusturur.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if to_regclass('public.vehicle_comparison_comments') is not null then
    execute 'delete from public.vehicle_comparison_comments';
  end if;

  if to_regclass('public.vehicle_comparison_generation_jobs') is not null then
    execute 'delete from public.vehicle_comparison_generation_jobs';
  end if;

  if to_regclass('public.vehicle_comparison_ai_reviews') is not null then
    execute 'delete from public.vehicle_comparison_ai_reviews';
  end if;

  if to_regclass('public.vehicle_comparison_items') is not null then
    execute 'delete from public.vehicle_comparison_items';
  end if;

  if to_regclass('public.vehicle_comparisons') is not null then
    execute 'delete from public.vehicle_comparisons';
  end if;

  if to_regclass('public.notifications') is not null then
    execute 'delete from public.notifications';
  end if;

  if to_regclass('public.comment_interactions') is not null then
    execute 'delete from public.comment_interactions';
  end if;

  if to_regclass('public.vehicle_comments') is not null then
    execute 'delete from public.vehicle_comments';
  end if;

  if to_regclass('public.vehicle_favorites') is not null then
    execute 'delete from public.vehicle_favorites';
  end if;

  if to_regclass('public.vehicle_ratings') is not null then
    execute 'delete from public.vehicle_ratings';
  end if;

  if to_regclass('public.user_vehicle_interactions') is not null then
    execute 'delete from public.user_vehicle_interactions';
  end if;

  if to_regclass('public.blog_posts') is not null then
    execute 'update public.blog_posts set author_id = null';
  end if;

  if to_regclass('public.users') is not null then
    execute 'delete from public.users';
  end if;
end $$;

alter table public.users
  drop column if exists password_hash;

alter table public.users
  alter column email drop not null;

alter table public.users
  add column if not exists is_admin boolean not null default false;

drop index if exists public.idx_users_username_lower;
create unique index if not exists idx_users_username_lower
  on public.users (lower(username));

create table if not exists public.user_vehicle_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  vehicle_id varchar not null references public.vehicle_market_profiles(id) on delete cascade,
  is_liked boolean default false,
  is_favorite boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_vehicle_interactions_user_id_vehicle_id_key unique (user_id, vehicle_id)
);

create index if not exists idx_interactions_user on public.user_vehicle_interactions (user_id);
create index if not exists idx_interactions_vehicle on public.user_vehicle_interactions (vehicle_id);

create table if not exists public.vehicle_comments (
  id uuid primary key default gen_random_uuid(),
  vehicle_id varchar not null references public.vehicle_market_profiles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  parent_id uuid references public.vehicle_comments(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vehicle_comments
  drop column if exists user_fingerprint,
  drop column if exists user_name,
  add column if not exists user_id uuid,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vehicle_comments_user_id_fkey'
      and conrelid = 'public.vehicle_comments'::regclass
  ) then
    alter table public.vehicle_comments
      add constraint vehicle_comments_user_id_fkey
      foreign key (user_id)
      references public.users(id)
      on delete cascade;
  end if;
end $$;

alter table public.vehicle_comments
  alter column user_id set not null;

create index if not exists idx_comments_vehicle on public.vehicle_comments (vehicle_id);
create index if not exists idx_comments_user on public.vehicle_comments (user_id);
create index if not exists idx_comments_parent on public.vehicle_comments (parent_id);

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

create table if not exists public.vehicle_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  vehicle_id varchar not null references public.vehicle_market_profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint vehicle_favorites_user_id_vehicle_id_key unique (user_id, vehicle_id)
);

create index if not exists idx_vehicle_favorites_user_id on public.vehicle_favorites (user_id);
create index if not exists idx_vehicle_favorites_vehicle_id on public.vehicle_favorites (vehicle_id);

create table if not exists public.comment_interactions (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.vehicle_comments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  constraint comment_interactions_comment_id_user_id_key unique (comment_id, user_id)
);

create index if not exists idx_comment_interactions_comment_id on public.comment_interactions (comment_id);
create index if not exists idx_comment_interactions_user_id on public.comment_interactions (user_id);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete cascade,
  vehicle_id varchar references public.vehicle_market_profiles(id) on delete cascade,
  comment_id uuid references public.vehicle_comments(id) on delete cascade,
  type text not null check (type in ('reply', 'vehicle_comment')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_created_at on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications (user_id, is_read);

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  content text not null default '',
  cover_image_url text,
  status text not null default 'published' check (status in ('draft', 'published')),
  author_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blog_posts_status_created_at on public.blog_posts (status, created_at desc);
create index if not exists idx_blog_posts_slug on public.blog_posts (slug);

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

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'users_id_auth_users_id_fkey'
      and conrelid = 'public.users'::regclass
  ) then
    alter table public.users
      add constraint users_id_auth_users_id_fkey
      foreign key (id)
      references auth.users(id)
      on delete cascade;
  end if;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select auth.uid();
$$;

create or replace function public.normalize_vehicle_comparison_comment()
returns trigger
language plpgsql
set search_path = ''
as $$
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
$$;

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

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

create or replace function public.ensure_unique_username(p_base_username text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 0;
begin
  v_base := lower(regexp_replace(coalesce(nullif(btrim(p_base_username), ''), 'kullanici'), '[^a-zA-Z0-9_]+', '_', 'g'));
  v_base := trim(both '_' from v_base);

  if char_length(v_base) < 3 then
    v_base := 'kullanici_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  end if;

  v_base := left(v_base, 40);
  v_candidate := v_base;

  while exists (select 1 from public.users where lower(username) = lower(v_candidate)) loop
    v_suffix := v_suffix + 1;
    v_candidate := left(v_base, greatest(1, 45 - char_length(v_suffix::text))) || '_' || v_suffix::text;
  end loop;

  return v_candidate;
end;
$$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_metadata jsonb;
  v_username text;
begin
  v_metadata := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username := public.ensure_unique_username(
    coalesce(
      v_metadata ->> 'username',
      v_metadata ->> 'name',
      split_part(new.email, '@', 1),
      'kullanici'
    )
  );

  insert into public.users (id, email, username, avatar_url)
  values (
    new.id,
    new.email,
    v_username,
    nullif(v_metadata ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    username = coalesce(public.users.username, excluded.username),
    avatar_url = coalesce(public.users.avatar_url, excluded.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

alter table public.users enable row level security;

drop policy if exists users_select_public_profile on public.users;
create policy users_select_public_profile
on public.users
for select
using (true);

drop policy if exists users_update_own_profile on public.users;
create policy users_update_own_profile
on public.users
for update
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists users_insert_own_profile on public.users;
create policy users_insert_own_profile
on public.users
for insert
with check (auth.uid() = id and is_admin = false);

alter table if exists public.vehicle_ratings enable row level security;
alter table if exists public.vehicle_favorites enable row level security;
alter table if exists public.user_vehicle_interactions enable row level security;
alter table if exists public.vehicle_comments enable row level security;
alter table if exists public.comment_interactions enable row level security;
alter table if exists public.notifications enable row level security;
alter table if exists public.blog_posts enable row level security;
alter table if exists public.vehicle_comparisons enable row level security;
alter table if exists public.vehicle_comparison_items enable row level security;
alter table if exists public.vehicle_comparison_comments enable row level security;
alter table if exists public.vehicle_comparison_generation_jobs enable row level security;
alter table if exists public.vehicle_comparison_ai_reviews enable row level security;

drop policy if exists vehicle_ratings_insert_own on public.vehicle_ratings;
create policy vehicle_ratings_insert_own on public.vehicle_ratings for insert with check (auth.uid() = user_id);
drop policy if exists vehicle_ratings_update_own on public.vehicle_ratings;
create policy vehicle_ratings_update_own on public.vehicle_ratings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists vehicle_ratings_delete_own on public.vehicle_ratings;
create policy vehicle_ratings_delete_own on public.vehicle_ratings for delete using (auth.uid() = user_id);

drop policy if exists vehicle_favorites_select_all on public.vehicle_favorites;
create policy vehicle_favorites_select_all on public.vehicle_favorites for select using (true);
drop policy if exists vehicle_favorites_insert_own on public.vehicle_favorites;
create policy vehicle_favorites_insert_own on public.vehicle_favorites for insert with check (auth.uid() = user_id);
drop policy if exists vehicle_favorites_delete_own on public.vehicle_favorites;
create policy vehicle_favorites_delete_own on public.vehicle_favorites for delete using (auth.uid() = user_id);

drop policy if exists vehicle_comments_select_all on public.vehicle_comments;
create policy vehicle_comments_select_all on public.vehicle_comments for select using (true);
drop policy if exists vehicle_comments_insert_own on public.vehicle_comments;
create policy vehicle_comments_insert_own on public.vehicle_comments for insert with check (auth.uid() = user_id);
drop policy if exists vehicle_comments_delete_own_or_admin on public.vehicle_comments;
create policy vehicle_comments_delete_own_or_admin on public.vehicle_comments
for delete
using (
  auth.uid() = user_id
  or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

drop policy if exists comment_interactions_select_all on public.comment_interactions;
create policy comment_interactions_select_all on public.comment_interactions for select using (true);
drop policy if exists comment_interactions_insert_own on public.comment_interactions;
create policy comment_interactions_insert_own on public.comment_interactions for insert with check (auth.uid() = user_id);
drop policy if exists comment_interactions_update_own on public.comment_interactions;
create policy comment_interactions_update_own on public.comment_interactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists comment_interactions_delete_own on public.comment_interactions;
create policy comment_interactions_delete_own on public.comment_interactions for delete using (auth.uid() = user_id);

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications for select using (auth.uid() = user_id);
drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists notifications_insert_system on public.notifications;
create policy notifications_insert_system on public.notifications for insert with check (false);

drop policy if exists user_vehicle_interactions_select_own on public.user_vehicle_interactions;
create policy user_vehicle_interactions_select_own on public.user_vehicle_interactions for select using (auth.uid() = user_id);
drop policy if exists user_vehicle_interactions_insert_own on public.user_vehicle_interactions;
create policy user_vehicle_interactions_insert_own on public.user_vehicle_interactions for insert with check (auth.uid() = user_id);
drop policy if exists user_vehicle_interactions_update_own on public.user_vehicle_interactions;
create policy user_vehicle_interactions_update_own on public.user_vehicle_interactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists user_vehicle_interactions_delete_own on public.user_vehicle_interactions;
create policy user_vehicle_interactions_delete_own on public.user_vehicle_interactions for delete using (auth.uid() = user_id);

drop policy if exists blog_posts_select_published_or_admin on public.blog_posts;
create policy blog_posts_select_published_or_admin on public.blog_posts
for select
using (
  status = 'published'
  or exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin)
);

drop policy if exists blog_posts_write_admin on public.blog_posts;
create policy blog_posts_write_admin on public.blog_posts
for all
using (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin))
with check (exists (select 1 from public.users u where u.id = auth.uid() and u.is_admin));

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

revoke all on table public.users from anon, authenticated;
grant select (id, username, avatar_url) on table public.users to anon, authenticated;
grant update (username, avatar_url) on table public.users to authenticated;

grant select, insert, update, delete on table public.user_vehicle_interactions to authenticated;
grant select on table public.vehicle_ratings to anon, authenticated;
grant insert, update, delete on table public.vehicle_ratings to authenticated;
grant select on table public.vehicle_favorites to anon, authenticated;
grant insert, delete on table public.vehicle_favorites to authenticated;
grant select on table public.vehicle_comments to anon, authenticated;
grant insert, delete on table public.vehicle_comments to authenticated;
grant select on table public.comment_interactions to anon, authenticated;
grant insert, update, delete on table public.comment_interactions to authenticated;
grant select, update on table public.notifications to authenticated;
grant select on table public.blog_posts to anon, authenticated;
grant insert, update, delete on table public.blog_posts to authenticated;
grant select on table public.vehicle_comparisons to authenticated;
grant select on table public.vehicle_comparison_items to authenticated;
grant select on table public.vehicle_comparison_ai_reviews to authenticated;
grant select, insert on table public.vehicle_comparison_comments to authenticated;
grant update (body, deleted_at) on table public.vehicle_comparison_comments to authenticated;
revoke all on table public.vehicle_comparison_generation_jobs from anon, authenticated;

grant execute on function public.current_app_user_id() to anon, authenticated, service_role;

commit;
