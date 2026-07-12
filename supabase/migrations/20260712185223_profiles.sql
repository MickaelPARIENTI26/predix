-- Predix — migration 0001: profiles
--
-- Repo conventions (docs/decisions.md):
-- * every migration that creates a table enables RLS in the same file;
--   default is deny-all, each policy must justify itself;
-- * RLS filters rows but confers no privilege — the cloud default no longer
--   auto-exposes new tables to the API roles, so explicit GRANTs live in the
--   same file too (column-level where it matters);
-- * all timestamps are timestamptz (UTC).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- created_at is server-assigned: no INSERT/UPDATE privilege on it.
grant select on public.profiles to authenticated;
grant insert (id, display_name) on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.profiles to service_role;

-- Any authenticated user can read profiles (needed to show names in a
-- competition). Nothing sensitive lives here.
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- A user manages only their own profile row.
-- (select auth.uid()) instead of bare auth.uid(): evaluated once per
-- statement, not per row — the pattern F3 will copy.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
