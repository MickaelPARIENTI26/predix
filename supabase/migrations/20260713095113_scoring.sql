-- Predix — migration 0008: results & scoring engine (F4)
--
-- Results enter through ONE door: set_match_result (organizer now; a
-- service_role / API writer plugs into the same door in the results-API
-- sprint later). Every result/rules change is logged append-only in
-- admin_events. Points are recomputed IDEMPOTENTLY into the scores cache
-- (recompute from scratch each time) so a correction or a rules change always
-- yields a consistent leaderboard.
--
-- F4 scores match_score predictions only (exact score / correct outcome).
-- Group-ranking, qualified-teams and bonus scoring arrive in F5/F6.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

-- One configurable rules row per competition. Absent row => defaults (below).
create table public.scoring_rules (
  competition_id uuid primary key references public.competitions (id) on delete cascade,
  config jsonb not null,
  -- set null (not cascade): keep the rules row if the editor's account is
  -- erased (F10), just drop the identity.
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.scoring_rules enable row level security;
grant select on public.scoring_rules to authenticated;
grant select, insert, update, delete on public.scoring_rules to service_role;

create policy "scoring_rules_select_members"
  on public.scoring_rules for select to authenticated
  using (public.is_competition_member(competition_id));
-- writes go through set_scoring_rules (SECURITY DEFINER); no direct grant.

-- Leaderboard cache. Written ONLY by recompute (as definer).
create table public.scores (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null default 0,
  breakdown jsonb not null default '{}'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (competition_id, user_id)
);
alter table public.scores enable row level security;
grant select on public.scores to authenticated;
grant select, insert, update, delete on public.scores to service_role;

create policy "scores_select_members"
  on public.scores for select to authenticated
  using (public.is_competition_member(competition_id));

-- Append-only audit of organizer/system actions (result entry/correction,
-- rules change). readable by organizers; the dispute views (F9) build on it.
create table public.admin_events (
  id bigint generated always as identity primary key,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,  -- keep the audit row on erasure
  kind text not null check (kind in ('result_set', 'result_cleared', 'scoring_rules_changed')),
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index admin_events_competition_idx on public.admin_events (competition_id, id);
alter table public.admin_events enable row level security;
grant select on public.admin_events to authenticated;
grant select, insert, update, delete on public.admin_events to service_role;

create policy "admin_events_select_organizer"
  on public.admin_events for select to authenticated
  using (public.is_competition_organizer(competition_id));

create or replace function public.forbid_admin_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'admin_events is append-only';
end;
$$;
create trigger admin_events_no_update
  before update on public.admin_events
  for each row execute function public.forbid_admin_event_mutation();

-- ===========================================================================
-- 2. Idempotent recompute
-- ===========================================================================
-- Recomputes the whole leaderboard for a competition from predictions_current
-- vs finished match results. Safe to run any number of times.
create or replace function public.recompute_competition_scores(p_comp uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rules jsonb;
  v_exact int;
  v_outcome int;
begin
  -- serialize recompute per competition (two doors — organizer + future API —
  -- must not race the delete+insert into a PK collision).
  perform pg_advisory_xact_lock(hashtextextended('scores:' || p_comp::text, 0));

  select config into v_rules from public.scoring_rules where competition_id = p_comp;
  -- numeric-first cast: config could hold 3.0 etc.
  v_exact := coalesce((v_rules ->> 'exact_score')::numeric::int, 3);
  v_outcome := coalesce((v_rules ->> 'correct_outcome')::numeric::int, 1);

  delete from public.scores where competition_id = p_comp;

  -- Every member gets a row (0 if they've scored nothing yet) so the leaderboard
  -- can read scores directly and no one vanishes from the standings.
  insert into public.scores (competition_id, user_id, points, breakdown, computed_at)
  select
    p_comp,
    cm.user_id,
    coalesce(agg.points, 0),
    coalesce(
      agg.breakdown,
      jsonb_build_object('exact', 0, 'outcome', 0, 'miss', 0,
        'rules', jsonb_build_object('exact_score', v_exact, 'correct_outcome', v_outcome))
    ),
    now()
  from public.competition_members cm
  left join (
    select
      s.user_id,
      sum(case s.result when 'exact' then v_exact when 'outcome' then v_outcome else 0 end) as points,
      jsonb_build_object(
        'exact', count(*) filter (where s.result = 'exact'),
        'outcome', count(*) filter (where s.result = 'outcome'),
        'miss', count(*) filter (where s.result = 'miss'),
        'rules', jsonb_build_object('exact_score', v_exact, 'correct_outcome', v_outcome)
      ) as breakdown
    from (
      select
        pc.user_id,
        case
          -- numeric-first cast: save_prediction accepts fractional notation
          -- ("2.0"), which a plain ::int cast would crash on.
          when (pc.payload ->> 'home')::numeric::int = m.home_score
           and (pc.payload ->> 'away')::numeric::int = m.away_score then 'exact'
          when sign((pc.payload ->> 'home')::numeric::int - (pc.payload ->> 'away')::numeric::int)
             = sign(m.home_score - m.away_score) then 'outcome'
          else 'miss'
        end as result
      from public.predictions_current pc
      join public.matches m on m.id = pc.target_id
      where pc.competition_id = p_comp
        and pc.target_kind = 'match_score'
        and m.status = 'finished'
        and m.home_score is not null
        and m.away_score is not null
    ) s
    group by s.user_id
  ) agg on agg.user_id = cm.user_id
  where cm.competition_id = p_comp
  on conflict (competition_id, user_id) do update
    set points = excluded.points,
        breakdown = excluded.breakdown,
        computed_at = excluded.computed_at;
end;
$$;

-- ===========================================================================
-- 3. The single result door + rules door (organizer; API reuses later)
-- ===========================================================================
-- NOTE (results-API sprint): this door authorizes via is_competition_organizer
-- (auth.uid()), so service_role can't call it as-is. The API writer sprint will
-- add a service branch (authorize on role/claim, stamp actor from a param).
create or replace function public.set_match_result(
  p_match uuid,
  p_home int,
  p_away int,
  p_status text default 'finished'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comp uuid;
begin
  select competition_id into v_comp from public.matches where id = p_match;
  if v_comp is null then
    raise exception 'unknown match' using errcode = 'P0002';
  end if;
  if not public.is_competition_organizer(v_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;
  if p_status not in ('scheduled', 'live', 'finished', 'postponed') then
    raise exception 'bad status' using errcode = '22023';
  end if;
  if p_status = 'finished' then
    if p_home is null or p_away is null
       or p_home < 0 or p_home > 99 or p_away < 0 or p_away > 99 then
      raise exception 'result requires scores 0..99' using errcode = '22023';
    end if;
  end if;

  update public.matches
    set home_score = case when p_status = 'finished' then p_home else null end,
        away_score = case when p_status = 'finished' then p_away else null end,
        status = p_status
  where id = p_match;

  insert into public.admin_events (competition_id, actor_user_id, kind, target_id, detail)
  values (
    v_comp, v_uid,
    case when p_status = 'finished' then 'result_set' else 'result_cleared' end,
    p_match,
    jsonb_build_object('home', p_home, 'away', p_away, 'status', p_status)
  );

  perform public.recompute_competition_scores(v_comp);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_scoring_rules(p_comp uuid, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_exact int;
  v_outcome int;
begin
  if not public.is_competition_organizer(p_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;
  -- validate the two configurable numbers (0..100)
  v_exact := (p_config ->> 'exact_score')::int;
  v_outcome := (p_config ->> 'correct_outcome')::int;
  if v_exact is null or v_outcome is null
     or v_exact < 0 or v_exact > 100 or v_outcome < 0 or v_outcome > 100 then
    raise exception 'invalid scoring rules' using errcode = '22023';
  end if;

  insert into public.scoring_rules (competition_id, config, updated_by, updated_at)
  values (p_comp, jsonb_build_object('exact_score', v_exact, 'correct_outcome', v_outcome), v_uid, now())
  on conflict (competition_id) do update
    set config = excluded.config, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.admin_events (competition_id, actor_user_id, kind, detail)
  values (p_comp, v_uid, 'scoring_rules_changed',
          jsonb_build_object('exact_score', v_exact, 'correct_outcome', v_outcome));

  perform public.recompute_competition_scores(p_comp);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_match_result(uuid, int, int, text) to authenticated;
grant execute on function public.set_scoring_rules(uuid, jsonb) to authenticated;

-- ===========================================================================
-- 4. Force results through the door
-- ===========================================================================
-- 0004 granted authenticated full INSERT/UPDATE on matches, which would let an
-- organizer set home_score/away_score/status directly — skipping the audit log
-- AND the recompute, leaving the leaderboard silently stale. Re-scope those
-- grants to the SETUP columns only; result columns are now writable only by
-- set_match_result (SECURITY DEFINER) and service_role.
revoke insert, update on public.matches from authenticated;
grant insert (competition_id, stage, group_id, home_team_id, away_team_id, label, kickoff_at)
  on public.matches to authenticated;
grant update (stage, group_id, home_team_id, away_team_id, label, kickoff_at)
  on public.matches to authenticated;
