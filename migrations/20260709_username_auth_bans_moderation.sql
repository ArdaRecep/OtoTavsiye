create extension if not exists pgcrypto;

alter table public.users
  alter column email drop not null;

create unique index if not exists idx_users_username_lower
  on public.users (lower(username));

create table if not exists public.user_bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  ban_type text not null check (ban_type in ('chat', 'access')),
  reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_bans_user_type_active
  on public.user_bans (user_id, ban_type, revoked_at, expires_at);

create table if not exists public.user_auth_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  identity_type text not null check (identity_type in ('ip', 'device')),
  identity_hash text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint user_auth_identities_user_id_identity_type_identity_hash_key
    unique (user_id, identity_type, identity_hash)
);

create index if not exists idx_user_auth_identities_hash
  on public.user_auth_identities (identity_type, identity_hash);

create table if not exists public.auth_identity_bans (
  id uuid primary key default gen_random_uuid(),
  identity_type text not null check (identity_type in ('ip', 'device')),
  identity_hash text not null,
  source_user_id uuid references public.users(id) on delete set null,
  reason text,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_identity_bans_hash_active
  on public.auth_identity_bans (identity_type, identity_hash, revoked_at, expires_at);

create table if not exists public.forbidden_words (
  id uuid primary key default gen_random_uuid(),
  word text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_forbidden_words_active
  on public.forbidden_words (active);

insert into public.forbidden_words (word)
values ('piç'), ('oç'), ('pic'), ('oc')
on conflict (word) do nothing;

alter table public.user_bans enable row level security;
alter table public.user_auth_identities enable row level security;
alter table public.auth_identity_bans enable row level security;
alter table public.forbidden_words enable row level security;
