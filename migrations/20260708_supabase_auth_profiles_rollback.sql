-- Supabase Auth gecisi rollback.
-- Not: Bu dosya eski SHA-256 parola verilerini geri getirmez; yalnizca schema seviyesinde geri donus saglar.

begin;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_auth_user();
drop function if exists public.ensure_unique_username(text);

drop table if exists public.vehicle_comparison_comments;
drop table if exists public.vehicle_comparison_generation_jobs;
drop table if exists public.vehicle_comparison_ai_reviews;
drop table if exists public.vehicle_comparison_items;
drop table if exists public.vehicle_comparisons;
drop function if exists public.normalize_vehicle_comparison_comment();

alter table public.users
  drop constraint if exists users_id_auth_users_id_fkey;

alter table public.users
  add column if not exists password_hash varchar(64);

alter table public.users disable row level security;

drop policy if exists users_select_public_profile on public.users;
drop policy if exists users_update_own_profile on public.users;
drop policy if exists users_insert_own_profile on public.users;

commit;
