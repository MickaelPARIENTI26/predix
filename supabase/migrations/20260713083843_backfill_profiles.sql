-- Predix — migration 0006: backfill profiles for pre-trigger accounts
--
-- On an environment where auth users were created before handle_new_user
-- existed (e.g. prod, set up after dev), those users have no profile row and
-- can't own a competition (competitions.owner_user_id -> profiles FK). This
-- creates the missing profile, using the same fallback logic as the trigger.
-- Idempotent (on conflict do nothing) and a no-op where every user already
-- has a profile — safe to run on every environment.

insert into public.profiles (id, display_name, phone)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(u.email, '@', 1), ''),
      'Joueur'
    ),
    40
  ),
  nullif(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
