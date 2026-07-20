-- ---------------------------------------------------------------------------
-- Stop exposing profiles.phone to every authenticated user (PII leak).
--
-- 0001 granted a table-wide `select on public.profiles to authenticated` with
-- policy profiles_select_authenticated USING (true) — justified then by
-- "nothing sensitive lives here". 0005 (profile_phone) later ADDED an E.164
-- `phone` column (collected at signup for WhatsApp) but never narrowed the read.
-- A whole-table SELECT covers columns added later, so any registered user could
-- `GET /rest/v1/profiles?select=id,display_name,phone` with their own JWT and
-- harvest every user's phone number — regardless of any shared competition.
--
-- RLS is row-level and cannot hide a single column, so scope the column grant:
-- authenticated may read id/display_name/created_at of any row (needed to show
-- names), but NOT phone. The owner reads their own full row through a self-only
-- SECURITY DEFINER door. Self-writes are unchanged (grant update(phone) + the
-- update-own policy from 0001/0005), and the app never writes phone with a
-- RETURNING, so no read privilege is needed there.
-- ---------------------------------------------------------------------------

revoke select on public.profiles from authenticated;
grant select (id, display_name, created_at) on public.profiles to authenticated;

-- Self-only read door for the owner's full profile (including phone).
create or replace function public.get_my_profile()
returns table (id uuid, display_name text, phone text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name, p.phone, p.created_at
  from public.profiles p
  where p.id = (select auth.uid());
$$;

grant execute on function public.get_my_profile() to authenticated;
