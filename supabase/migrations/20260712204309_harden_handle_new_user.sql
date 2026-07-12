-- Predix — migration 0003: harden the profile-creation trigger
--
-- Two fixes over 0002 (a failing trigger blocks ALL signups, so the body must
-- be bulletproof):
--   1. Guard the email fallback with nullif: an empty local part (email like
--      '@x.com', or an admin/OAuth-created user with an empty email) produced
--      '' and violated the profiles CHECK (char_length >= 1), aborting signup.
--      Now it falls through to the literal 'Joueur'.
--   2. on conflict (id) do nothing: if a profile already exists (re-fire,
--      manual backfill), the insert is a no-op instead of a unique_violation.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(split_part(new.email, '@', 1), ''),
        'Joueur'
      ),
      40
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
