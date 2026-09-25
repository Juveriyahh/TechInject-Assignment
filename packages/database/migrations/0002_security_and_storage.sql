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
