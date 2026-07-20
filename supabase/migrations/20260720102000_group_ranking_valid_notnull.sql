-- ---------------------------------------------------------------------------
-- is_valid_group_ranking must never return SQL NULL.
--
-- When a group_ranking payload omits the "ranking" key, p_payload->'ranking' is
-- SQL NULL. jsonb_typeof(NULL)='array' is NULL, and for an EMPTY group (0
-- group_teams) the count/except conjuncts are all TRUE, so the whole AND-chain
-- evaluates to NULL. In save_prediction the guard is `if not
-- is_valid_group_ranking(...) then <reject>`; `not NULL` is NULL, so the reject
-- branch is skipped and a malformed prediction is stored as outcome='accepted'
-- instead of 'rejected_invalid' — polluting the append-only audit log (the very
-- thing this app must keep trustworthy). The window is narrow (an empty group
-- with a resolvable future lock), the row is inert (0 points, no crash), but a
-- mislabeled audit row is exactly what we don't tolerate.
--
-- Fix: null/non-array input is simply invalid. Lead with an explicit null +
-- array check and coalesce the whole predicate to false so it can never be NULL.
-- ---------------------------------------------------------------------------

create or replace function public.is_valid_group_ranking(p_group uuid, p_ranking jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_ranking is not null
    and jsonb_typeof(p_ranking) = 'array'
    and not exists (
      select 1 from jsonb_array_elements(
        case when jsonb_typeof(p_ranking) = 'array' then p_ranking else '[]'::jsonb end
      ) e
      where jsonb_typeof(e) <> 'string'
        or (e #>> '{}') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    )
    and (
      select count(*) from jsonb_array_elements_text(
        case when jsonb_typeof(p_ranking) = 'array' then p_ranking else '[]'::jsonb end
      )
    ) = (select count(*) from public.group_teams where group_id = p_group)
    and (
      select count(distinct v) from jsonb_array_elements_text(
        case when jsonb_typeof(p_ranking) = 'array' then p_ranking else '[]'::jsonb end
      ) v
    ) = (select count(*) from public.group_teams where group_id = p_group)
    and not exists (
      select public.try_uuid(value) from jsonb_array_elements_text(
        case when jsonb_typeof(p_ranking) = 'array' then p_ranking else '[]'::jsonb end
      )
      except
      select team_id from public.group_teams where group_id = p_group
    ),
    false
  );
$$;
