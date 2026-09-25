-- Tech Inject Design Library — one-shot bootstrap for a hosted Supabase project.
-- Paste the whole file into the Supabase dashboard SQL editor and run it.
-- Equivalent to `pnpm db:migrate`; safe to run more than once.

create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now());

-- ============================================================
-- migrations/0001_init.sql
-- ============================================================
-- Tech Inject Design Library — core schema.
-- Idempotent: safe to run repeatedly against the same database.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('CUSTOMER', 'ADMIN');
  end if;

  if not exists (select 1 from pg_type where typname = 'component_tier') then
    create type public.component_tier as enum ('FREE', 'PREMIUM');
  end if;

  if not exists (select 1 from pg_type where typname = 'component_file_type') then
    create type public.component_file_type as enum ('SOURCE', 'PREVIEW_FIXTURE', 'STYLE', 'METADATA');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — customer and administrator accounts
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role public.user_role not null default 'CUSTOMER',
  is_premium boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

-- ---------------------------------------------------------------------------
-- components — publishable design-library entries
-- ---------------------------------------------------------------------------
create table if not exists public.components (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null,
  tier public.component_tier not null default 'FREE',
  is_published boolean not null default false,
  version text not null default '1.0.0',
  props_schema jsonb not null default '[]'::jsonb,
  dependencies jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint components_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint components_version_format check (version ~ '^\d+\.\d+\.\d+$')
);

create index if not exists components_published_idx on public.components (is_published);
create index if not exists components_category_idx on public.components (category);
create index if not exists components_tier_idx on public.components (tier);

-- ---------------------------------------------------------------------------
-- component_files — source, fixtures, styles and metadata per component
-- ---------------------------------------------------------------------------
create table if not exists public.component_files (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id) on delete cascade,
  file_path text not null,
  content text not null,
  file_type public.component_file_type not null default 'SOURCE',
  created_at timestamptz not null default now(),
  constraint component_files_unique_path unique (component_id, file_path)
);

create index if not exists component_files_component_idx on public.component_files (component_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists components_set_updated_at on public.components;
create trigger components_set_updated_at
  before update on public.components
  for each row execute function public.set_updated_at();

-- ============================================================
-- migrations/0002_security_and_storage.sql
-- ============================================================
-- Row level security and private storage for the design library.
--
-- Threat model: the anon/authenticated Supabase keys ship to browsers, so every
-- table is RLS-protected and deny-by-default. Draft components are invisible to
-- everyone except the service role (used only by the admin server runtime), and
-- PREMIUM source files are readable only by premium customers.

alter table public.profiles enable row level security;
alter table public.components enable row level security;
alter table public.component_files enable row level security;

-- --------------------------------------------------------------------------
-- profiles: a signed-in customer may read only their own row. Administrative
-- reads and writes go through the service role, which bypasses RLS.
-- --------------------------------------------------------------------------
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select
  to authenticated
  using (email = (auth.jwt() ->> 'email'));

-- --------------------------------------------------------------------------
-- components: published rows are public metadata; drafts stay private.
-- --------------------------------------------------------------------------
drop policy if exists "components_published_select" on public.components;
create policy "components_published_select" on public.components
  for select
  to anon, authenticated
  using (is_published = true);

-- --------------------------------------------------------------------------
-- component_files: readable only when the parent component is published and
-- either FREE or the caller is a premium customer.
-- --------------------------------------------------------------------------
drop policy if exists "component_files_entitled_select" on public.component_files;
create policy "component_files_entitled_select" on public.component_files
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.components c
      where c.id = component_files.component_id
        and c.is_published = true
        and (
          c.tier = 'FREE'
          or exists (
            select 1
            from public.profiles p
            where p.email = (auth.jwt() ->> 'email')
              and p.is_premium = true
          )
        )
    )
  );

-- --------------------------------------------------------------------------
-- Private storage bucket for uploaded component bundles.
-- `public = false` means objects are never retrievable through an
-- unauthenticated public URL; access requires a service-role signed URL.
-- --------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('component-bundles', 'component-bundles', false, 5242880, array['application/json'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- No storage policies are created for anon/authenticated: the bucket is
-- deliberately service-role only.
drop policy if exists "component_bundles_anon_read" on storage.objects;

insert into public._migrations (name) values ('0001_init.sql'), ('0002_security_and_storage.sql') on conflict (name) do nothing;
