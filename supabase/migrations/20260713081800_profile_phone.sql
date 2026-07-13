-- Predix — migration 0005: phone number on profiles (for WhatsApp in F8)
--
-- Collected at signup and editable in the profile. Stored E.164 (the app
-- normalizes before saving); the CHECK is a last-line guard. Nullable so the
-- existing rows (and any future non-email provider) stay valid.

alter table public.profiles
  add column phone text
  check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

-- let a user set/change their own phone (composes with the existing
-- update(display_name) grant from migration 0001)
grant update (phone) on public.profiles to authenticated;

-- trigger now also stores the phone passed in signup metadata (already
-- normalized + validated by the Server Action; nullif keeps '' out).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, phone)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Joueur'
      ),
      40
    ),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
