-- Predix — migration 0002: auto-create a profile on signup
--
-- A profile must exist for every auth user, created atomically with the user
-- (never "a user with no profile" if the app crashes mid-signup). The signup
-- form passes display_name in the user metadata; this trigger reads it and
-- falls back to the email local-part, clamped to the profiles length check.
--
-- security definer + empty search_path is the hardened pattern: the function
-- runs as owner (needed to write public.profiles from the auth insert), and
-- every object is schema-qualified so no search_path injection is possible.

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
        split_part(new.email, '@', 1),
        'Joueur'
      ),
      40
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
