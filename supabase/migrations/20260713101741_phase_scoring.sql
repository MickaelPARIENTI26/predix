-- Predix — migration 0009: 3-phase, 3-dimension scoring
--
-- Upgrades F4's flat {exact_score, correct_outcome} to a per-phase barème the
-- organizer can edit at any time. Three phases, mapped from match.stage:
--   groups   <- 'group'
--   knockout <- 'round_of_16','quarter','semi','third_place'
--   final    <- 'final'
-- Each phase carries three dimensions, applied in a strict cascade per
-- prediction on a finished match:
--   exact   : predicted score == actual score
--   diff    : else same goal difference (implies same winner), e.g. 2-1 vs 3-2
--   outcome : else same winner/draw direction, e.g. 2-1 vs 4-0
--   miss    : else 0
-- config shape: {"groups":{"exact":4,"diff":3,"outcome":2}, "knockout":{...}, "final":{...}}

-- ---------------------------------------------------------------------------
-- recompute: classify each prediction, map its match to a phase, award that
-- phase's points. Idempotent, serialized per competition, 0-row per member.
-- ---------------------------------------------------------------------------
create or replace function public.recompute_competition_scores(p_comp uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('scores:' || p_comp::text, 0));

  delete from public.scores where competition_id = p_comp;

  insert into public.scores (competition_id, user_id, points, breakdown, computed_at)
  with rules as (
    select coalesce(
      (select config from public.scoring_rules where competition_id = p_comp),
      '{}'::jsonb
    ) as cfg
  ),
  scored as (
    select
      pc.user_id,
      case
        when m.stage = 'group' then 'groups'
        when m.stage = 'final' then 'final'
        else 'knockout'
      end as phase,
      case
        -- numeric-first casts: save_prediction accepts fractional notation "2.0"
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
      and m.home_score is not null
      and m.away_score is not null
  ),
  pointed as (
    select
      s.user_id,
      s.result,
      case s.result
        when 'exact'   then coalesce((r.cfg -> s.phase ->> 'exact')::numeric::int, 4)
        when 'diff'    then coalesce((r.cfg -> s.phase ->> 'diff')::numeric::int, 3)
        when 'outcome' then coalesce((r.cfg -> s.phase ->> 'outcome')::numeric::int, 2)
        else 0
      end as pts
    from scored s cross join rules r
  )
  select
    p_comp,
    cm.user_id,
    coalesce(agg.points, 0),
    coalesce(
      agg.breakdown,
      '{"exact":0,"diff":0,"outcome":0,"miss":0}'::jsonb
    ),
    now()
  from public.competition_members cm
  left join (
    select
      p.user_id,
      sum(p.pts) as points,
      jsonb_build_object(
        'exact', count(*) filter (where p.result = 'exact'),
        'diff', count(*) filter (where p.result = 'diff'),
        'outcome', count(*) filter (where p.result = 'outcome'),
        'miss', count(*) filter (where p.result = 'miss')
      ) as breakdown
    from pointed p
    group by p.user_id
  ) agg on agg.user_id = cm.user_id
  where cm.competition_id = p_comp
  on conflict (competition_id, user_id) do update
    set points = excluded.points,
        breakdown = excluded.breakdown,
        computed_at = excluded.computed_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_scoring_rules: validate + store the per-phase barème, log, recompute.
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
  v_e int;
  v_d int;
  v_o int;
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
