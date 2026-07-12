-- Predix — migration 0001: profiles
--
-- Repo convention (docs/decisions.md): every migration that creates a table
-- enables RLS in the same file. Default is deny-all; each policy added must
-- justify itself. All timestamps are timestamptz (UTC).

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any authenticated user can read profiles (needed to show names in a
-- competition). Nothing sensitive lives here.
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- A user manages only their own profile row.
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
