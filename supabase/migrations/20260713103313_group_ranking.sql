-- Predix — migration 0010: group-ranking predictions & scoring (F5)
--
-- Players predict the final order of each group (kind='group_ranking', target =
-- group id, payload {"ranking":[team_id,…]} best→worst). save_prediction now
-- VALIDATES the ranking at the door (must be an array of distinct UUID-format
-- ids that are exactly the group's teams) → 'rejected_invalid' otherwise, and
-- recompute is immunized (try_uuid + array guard) so no stored payload can ever
-- crash scoring / freeze result entry.
--
-- Actual standings are computed from finished group matches
-- (points → goal difference → goals for → team_id). A group is scored only once
-- ALL its matches are finished. Barème: config.group_ranking.per_position pts
-- per team placed in its exact final position (default 1).
--
-- Qualified-team (knockout progression) predictions are deferred until the
-- bracket-resolution work.

-- ---------------------------------------------------------------------------
-- Crash-proof helpers
-- ---------------------------------------------------------------------------

-- Never throws: returns null for anything that isn't a valid uuid. Used so
-- untrusted payload text can never abort scoring.
create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

-- A ranking is valid iff it is a json array of distinct UUID-format strings that
-- are exactly the group's teams. All SRF inputs are array-guarded so a scalar/
-- object ranking can't crash it regardless of planner choices.
create or replace function public.is_valid_group_ranking(p_group uuid, p_ranking jsonb)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    jsonb_typeof(p_ranking) = 'array'
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
    );
$$;

-- ---------------------------------------------------------------------------
-- Final standings of a group from its finished matches. Deterministic total
-- order: points → goal difference → goals for → team_id (a stable uuid).
-- ---------------------------------------------------------------------------
create or replace function public.group_standings(p_group uuid)
returns table (team_id uuid, rank bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with gm as (
    select home_team_id, away_team_id, home_score, away_score
    from public.matches
    where group_id = p_group
      and status = 'finished'
      and home_score is not null
      and away_score is not null
  ),
  per_team as (
    select
      gt.team_id,
      coalesce(sum(x.pts), 0) as points,
      coalesce(sum(x.gf), 0) as gf,
      coalesce(sum(x.ga), 0) as ga
    from public.group_teams gt
    left join lateral (
      select
        case when m.home_score > m.away_score then 3
             when m.home_score = m.away_score then 1 else 0 end as pts,
        m.home_score as gf, m.away_score as ga
      from gm m where m.home_team_id = gt.team_id
      union all
      select
        case when m.away_score > m.home_score then 3
             when m.away_score = m.home_score then 1 else 0 end,
        m.away_score, m.home_score
      from gm m where m.away_team_id = gt.team_id
    ) x on true
    where gt.group_id = p_group
    group by gt.team_id
  )
  select
    pt.team_id,
    row_number() over (order by pt.points desc, (pt.gf - pt.ga) desc, pt.gf desc, pt.team_id) as rank
  from per_team pt;
$$;

grant execute on function public.group_standings(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- save_prediction — re-emitted with a group_ranking validation branch (step 5).
-- Everything else is identical to migration 0007.
-- ---------------------------------------------------------------------------
create or replace function public.save_prediction(
  p_event_uuid uuid,
  p_kind text,
  p_target uuid,
  p_payload jsonb,
  p_base_version int default null,
  p_device_id text default null,
  p_client_sent_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comp uuid;
  v_now timestamptz;
  v_lock timestamptz;
  v_prior public.prediction_events;
  v_cur public.predictions_current;
  v_new_version int;
  v_event_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('match_score', 'group_ranking', 'qualified_teams', 'bonus') then
    raise exception 'unknown prediction kind' using errcode = '22023';
  end if;

  -- (1) resolve competition + membership
  v_comp := public.prediction_competition_id(p_kind, p_target);
  if v_comp is null then
    raise exception 'unknown target' using errcode = 'P0002';
  end if;
  if not exists (
    select 1 from public.competition_members m
    where m.competition_id = v_comp and m.user_id = v_uid
  ) then
    raise exception 'not a member' using errcode = '42501';
  end if;

  -- (2) idempotent replay — BEFORE the lock gate
  select * into v_prior
  from public.prediction_events
  where user_id = v_uid and event_uuid = p_event_uuid
  order by id desc
  limit 1;
  if found then
    if v_prior.target_kind <> p_kind or v_prior.target_id <> p_target then
      raise exception 'idempotency key reused for a different target' using errcode = '22023';
    end if;
    return jsonb_build_object(
      'outcome', 'replayed',
      'original_outcome', v_prior.outcome,
      'version', v_prior.resulting_version,
      'server_received_at', v_prior.server_received_at,
      'lock_at', v_prior.lock_at
    );
  end if;

  -- (3) serialize saves for this (user, target)
  perform pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':' || p_kind || ':' || p_target::text, 0)
  );

  -- (4) one clock, captured after the lock wait
  v_now := clock_timestamp();

  -- (5) semantic payload validation
  if p_kind = 'match_score' then
    if not (
      p_payload ? 'home' and p_payload ? 'away'
      and jsonb_typeof(p_payload -> 'home') = 'number'
      and jsonb_typeof(p_payload -> 'away') = 'number'
      and (p_payload ->> 'home')::numeric = floor((p_payload ->> 'home')::numeric)
      and (p_payload ->> 'away')::numeric = floor((p_payload ->> 'away')::numeric)
      and (p_payload ->> 'home')::numeric between 0 and 99
      and (p_payload ->> 'away')::numeric between 0 and 99
    ) then
      insert into public.prediction_events (
        event_uuid, competition_id, user_id, target_kind, target_id, payload,
        outcome, base_version, lock_at, server_received_at, client_sent_at, device_id
      ) values (
        p_event_uuid, v_comp, v_uid, p_kind, p_target, p_payload,
        'rejected_invalid', p_base_version,
        public.prediction_lock_at(p_kind, p_target), v_now, p_client_sent_at, p_device_id
      );
      return jsonb_build_object('outcome', 'rejected_invalid', 'server_received_at', v_now);
    end if;
  elsif p_kind = 'group_ranking' then
    if not public.is_valid_group_ranking(p_target, p_payload -> 'ranking') then
      insert into public.prediction_events (
        event_uuid, competition_id, user_id, target_kind, target_id, payload,
        outcome, base_version, lock_at, server_received_at, client_sent_at, device_id
      ) values (
        p_event_uuid, v_comp, v_uid, p_kind, p_target, p_payload,
        'rejected_invalid', p_base_version,
        public.prediction_lock_at(p_kind, p_target), v_now, p_client_sent_at, p_device_id
      );
      return jsonb_build_object('outcome', 'rejected_invalid', 'server_received_at', v_now);
    end if;
  end if;

  -- (6) lock check
  v_lock := public.prediction_lock_at(p_kind, p_target);
  if v_lock is null or v_now >= v_lock then
    insert into public.prediction_events (
      event_uuid, competition_id, user_id, target_kind, target_id, payload,
      outcome, base_version, lock_at, server_received_at, client_sent_at, device_id
    ) values (
      p_event_uuid, v_comp, v_uid, p_kind, p_target, p_payload,
      'rejected_locked', p_base_version, v_lock, v_now, p_client_sent_at, p_device_id
    );
    return jsonb_build_object('outcome', 'rejected_locked', 'lock_at', v_lock, 'server_received_at', v_now);
  end if;

  -- (7) optimistic version check under the advisory lock
  select * into v_cur
  from public.predictions_current
  where user_id = v_uid and target_kind = p_kind and target_id = p_target;

  if found then
    if p_base_version is distinct from v_cur.version then
      insert into public.prediction_events (
        event_uuid, competition_id, user_id, target_kind, target_id, payload,
        outcome, base_version, conflict_current_version, previous_payload,
        lock_at, server_received_at, client_sent_at, device_id
      ) values (
        p_event_uuid, v_comp, v_uid, p_kind, p_target, p_payload,
        'rejected_conflict', p_base_version, v_cur.version, v_cur.payload,
        v_lock, v_now, p_client_sent_at, p_device_id
      );
      return jsonb_build_object(
        'outcome', 'rejected_conflict',
        'current_version', v_cur.version,
        'current_payload', v_cur.payload,
        'server_received_at', v_now
      );
    end if;
    v_new_version := v_cur.version + 1;
  else
    if p_base_version is not null and p_base_version <> 0 then
      insert into public.prediction_events (
        event_uuid, competition_id, user_id, target_kind, target_id, payload,
        outcome, base_version, conflict_current_version,
        lock_at, server_received_at, client_sent_at, device_id
      ) values (
        p_event_uuid, v_comp, v_uid, p_kind, p_target, p_payload,
        'rejected_conflict', p_base_version, 0,
        v_lock, v_now, p_client_sent_at, p_device_id
      );
      return jsonb_build_object('outcome', 'rejected_conflict', 'current_version', 0, 'server_received_at', v_now);
    end if;
    v_new_version := 1;
  end if;

  -- (8) write the accepted event, then upsert the projection
  insert into public.prediction_events (
    event_uuid, competition_id, user_id, target_kind, target_id, payload,
    outcome, base_version, resulting_version, lock_at, server_received_at, client_sent_at, device_id
  ) values (
    p_event_uuid, v_comp, v_uid, p_kind, p_target, p_payload,
    'accepted', p_base_version, v_new_version, v_lock, v_now, p_client_sent_at, p_device_id
  )
  returning id into v_event_id;

  insert into public.predictions_current (
    competition_id, user_id, target_kind, target_id, payload, version, last_event_id, updated_at
  ) values (
    v_comp, v_uid, p_kind, p_target, p_payload, v_new_version, v_event_id, v_now
  )
  on conflict (user_id, target_kind, target_id) do update
    set payload = excluded.payload,
        version = excluded.version,
        last_event_id = excluded.last_event_id,
        updated_at = excluded.updated_at;

  return jsonb_build_object(
    'outcome', 'accepted',
    'version', v_new_version,
    'server_received_at', v_now
  );

exception
  when unique_violation then
    select * into v_prior
    from public.prediction_events
    where user_id = v_uid and event_uuid = p_event_uuid
    order by id desc
    limit 1;
    if found then
      if v_prior.target_kind <> p_kind or v_prior.target_id <> p_target then
        raise exception 'idempotency key reused for a different target' using errcode = '22023';
      end if;
      return jsonb_build_object(
        'outcome', 'replayed',
        'original_outcome', v_prior.outcome,
        'version', v_prior.resulting_version,
        'server_received_at', v_prior.server_received_at,
        'lock_at', v_prior.lock_at
      );
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- recompute: match-score points (per phase) + group-ranking points.
-- Group-ranking join uses try_uuid + array guard so no stored payload can crash
-- scoring / freeze result entry for the competition.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_competition_scores(p_comp uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cfg jsonb;
  v_per_position int;
begin
  perform pg_advisory_xact_lock(hashtextextended('scores:' || p_comp::text, 0));

  select coalesce(config, '{}'::jsonb) into v_cfg
  from public.scoring_rules where competition_id = p_comp;
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_per_position := coalesce((v_cfg -> 'group_ranking' ->> 'per_position')::numeric::int, 1);

  delete from public.scores where competition_id = p_comp;

  insert into public.scores (competition_id, user_id, points, breakdown, computed_at)
  with
  ms as (
    select
      s.user_id,
      sum(case s.result
            when 'exact'   then coalesce((v_cfg -> s.phase ->> 'exact')::numeric::int, 4)
            when 'diff'    then coalesce((v_cfg -> s.phase ->> 'diff')::numeric::int, 3)
            when 'outcome' then coalesce((v_cfg -> s.phase ->> 'outcome')::numeric::int, 2)
            else 0 end) as points,
      count(*) filter (where s.result = 'exact') as exact,
      count(*) filter (where s.result = 'diff') as diff,
      count(*) filter (where s.result = 'outcome') as outcome,
      count(*) filter (where s.result = 'miss') as miss
    from (
      select
        pc.user_id,
        case when m.stage = 'group' then 'groups'
             when m.stage = 'final' then 'final'
             else 'knockout' end as phase,
        case
          when (pc.payload ->> 'home')::numeric::int = m.home_score
           and (pc.payload ->> 'away')::numeric::int = m.away_score then 'exact'
          when ((pc.payload ->> 'home')::numeric::int - (pc.payload ->> 'away')::numeric::int)
             = (m.home_score - m.away_score) then 'diff'
          when sign((pc.payload ->> 'home')::numeric::int - (pc.payload ->> 'away')::numeric::int)
             = sign(m.home_score - m.away_score) then 'outcome'
          else 'miss'
        end as result
      from public.predictions_current pc
      join public.matches m on m.id = pc.target_id
      where pc.competition_id = p_comp
        and pc.target_kind = 'match_score'
        and m.status = 'finished'
        and m.home_score is not null and m.away_score is not null
    ) s
    group by s.user_id
  ),
  gr as (
    select h.user_id, sum(h.hit) as hits
    from (
      select
        pc.user_id,
        case when std.rank = elem.pos then 1 else 0 end as hit
      from public.predictions_current pc
      cross join lateral jsonb_array_elements_text(
        case when jsonb_typeof(pc.payload -> 'ranking') = 'array'
             then pc.payload -> 'ranking' else '[]'::jsonb end
      ) with ordinality as elem(team_id, pos)
      join lateral public.group_standings(pc.target_id) std
        on std.team_id = public.try_uuid(elem.team_id)
      where pc.competition_id = p_comp
        and pc.target_kind = 'group_ranking'
        and exists (select 1 from public.matches m
                    where m.group_id = pc.target_id and m.status = 'finished')
        and not exists (select 1 from public.matches m
                        where m.group_id = pc.target_id and m.status <> 'finished')
    ) h
    group by h.user_id
  )
  select
    p_comp,
    cm.user_id,
    coalesce(ms.points, 0) + coalesce(gr.hits, 0) * v_per_position,
    jsonb_build_object(
      'exact', coalesce(ms.exact, 0),
      'diff', coalesce(ms.diff, 0),
      'outcome', coalesce(ms.outcome, 0),
      'miss', coalesce(ms.miss, 0),
      'ranking_hits', coalesce(gr.hits, 0)
    ),
    now()
  from public.competition_members cm
  left join ms on ms.user_id = cm.user_id
  left join gr on gr.user_id = cm.user_id
  where cm.competition_id = p_comp
  on conflict (competition_id, user_id) do update
    set points = excluded.points,
        breakdown = excluded.breakdown,
        computed_at = excluded.computed_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_scoring_rules: match-score phases + the group_ranking section.
-- ---------------------------------------------------------------------------
create or replace function public.set_scoring_rules(p_comp uuid, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_phase text;
  v_norm jsonb := '{}'::jsonb;
  v_e int; v_d int; v_o int;
  v_pos int;
begin
  if not public.is_competition_organizer(p_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;

  foreach v_phase in array array['groups', 'knockout', 'final'] loop
    v_e := (p_config -> v_phase ->> 'exact')::int;
    v_d := (p_config -> v_phase ->> 'diff')::int;
    v_o := (p_config -> v_phase ->> 'outcome')::int;
    if v_e is null or v_d is null or v_o is null
       or v_e < 0 or v_e > 100 or v_d < 0 or v_d > 100 or v_o < 0 or v_o > 100 then
      raise exception 'invalid scoring rules for phase %', v_phase using errcode = '22023';
    end if;
    v_norm := v_norm || jsonb_build_object(
      v_phase, jsonb_build_object('exact', v_e, 'diff', v_d, 'outcome', v_o)
    );
  end loop;

  v_pos := coalesce((p_config -> 'group_ranking' ->> 'per_position')::int, 1);
  if v_pos < 0 or v_pos > 100 then
    raise exception 'invalid group_ranking rule' using errcode = '22023';
  end if;
  v_norm := v_norm || jsonb_build_object(
    'group_ranking', jsonb_build_object('per_position', v_pos)
  );

  insert into public.scoring_rules (competition_id, config, updated_by, updated_at)
  values (p_comp, v_norm, v_uid, now())
  on conflict (competition_id) do update
    set config = excluded.config, updated_by = excluded.updated_by, updated_at = excluded.updated_at;

  insert into public.admin_events (competition_id, actor_user_id, kind, detail)
  values (p_comp, v_uid, 'scoring_rules_changed', v_norm);

  perform public.recompute_competition_scores(p_comp);
  return jsonb_build_object('ok', true);
end;
$$;
