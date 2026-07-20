-- Predix — migration 0012: tournament bonus predictions (F6, part 2)
--
-- Three tournament-wide bonuses: top scorer, top assists, tournament winner.
-- Players predict via the generic save_prediction door (kind='bonus', target =
-- a bonus_questions row). Payload: {"player_id":…} for scorer/assists,
-- {"team_id":…} for the winner. Payload shape is validated at the app layer;
-- scoring is defensive (try_uuid) so no stored payload can crash recompute, so
-- save_prediction itself is left untouched.
--
-- The organizer sets each bonus's lock time and, after the tournament, its
-- answer (which triggers recompute). Points are configurable per bonus.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.tournament_players (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  team_id uuid references public.teams (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index tournament_players_competition_idx
  on public.tournament_players (competition_id);
alter table public.tournament_players enable row level security;
grant select, insert, update, delete on public.tournament_players to authenticated;
grant select, insert, update, delete on public.tournament_players to service_role;

create policy "tournament_players_select_members"
  on public.tournament_players for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "tournament_players_write_organizer"
  on public.tournament_players for all to authenticated
  using (public.is_competition_organizer(competition_id))
  with check (public.is_competition_organizer(competition_id));

create table public.bonus_questions (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  kind text not null check (kind in ('top_scorer', 'top_assists', 'tournament_winner')),
  lock_at timestamptz,
  answer jsonb,
  created_at timestamptz not null default now(),
  unique (competition_id, kind)
);
create index bonus_questions_competition_idx
  on public.bonus_questions (competition_id);
alter table public.bonus_questions enable row level security;
-- read-only for members; created/answered only through the RPCs below.
grant select on public.bonus_questions to authenticated;
grant select, insert, update, delete on public.bonus_questions to service_role;

create policy "bonus_questions_select_members"
  on public.bonus_questions for select to authenticated
  using (public.is_competition_member(competition_id));

-- audit: allow the bonus admin actions in admin_events
alter table public.admin_events drop constraint admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check
  check (kind in ('result_set', 'result_cleared', 'scoring_rules_changed',
                  'bonus_question_set', 'bonus_answer_set'));

-- ---------------------------------------------------------------------------
-- Prediction resolvers gain a 'bonus' branch (target = bonus_questions.id)
-- ---------------------------------------------------------------------------
create or replace function public.prediction_competition_id(p_kind text, p_target uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'match_score' then (select competition_id from public.matches where id = p_target)
    when 'group_ranking' then (select competition_id from public.groups where id = p_target)
    when 'qualified_teams' then (select competition_id from public.knockout_stages where id = p_target)
    when 'bonus' then (select competition_id from public.bonus_questions where id = p_target)
    else null
  end;
$$;

create or replace function public.prediction_lock_at(p_kind text, p_target uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case p_kind
    when 'match_score' then
      (select m.kickoff_at from public.matches m where m.id = p_target)
    when 'group_ranking' then
      coalesce(
        (select g.ranking_lock_at from public.groups g where g.id = p_target),
        (select min(m.kickoff_at) from public.matches m where m.group_id = p_target)
      )
    when 'qualified_teams' then
      coalesce(
        (select ks.lock_at from public.knockout_stages ks where ks.id = p_target),
        (select min(m.kickoff_at)
           from public.knockout_stages ks
           join public.matches m
             on m.competition_id = ks.competition_id and m.stage = ks.kind
          where ks.id = p_target)
      )
    when 'bonus' then
      (select bq.lock_at from public.bonus_questions bq where bq.id = p_target)
    else null
  end;
$$;

-- ---------------------------------------------------------------------------
-- Organizer RPCs: define a bonus (lock) and set its answer (+ recompute)
-- ---------------------------------------------------------------------------
create or replace function public.set_bonus_question(
  p_comp uuid,
  p_kind text,
  p_lock_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_competition_organizer(p_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;
  if p_kind not in ('top_scorer', 'top_assists', 'tournament_winner') then
    raise exception 'unknown bonus kind' using errcode = '22023';
  end if;
  -- a null lock would silently make the bonus unplayable (null lock = closed),
  -- so require it explicitly.
  if p_lock_at is null then
    raise exception 'bonus lock time required' using errcode = '22023';
  end if;

  insert into public.bonus_questions (competition_id, kind, lock_at)
  values (p_comp, p_kind, p_lock_at)
  on conflict (competition_id, kind) do update set lock_at = excluded.lock_at
  returning id into v_id;

  insert into public.admin_events (competition_id, actor_user_id, kind, detail)
  values (p_comp, (select auth.uid()), 'bonus_question_set',
          jsonb_build_object('kind', p_kind, 'lock_at', p_lock_at));

  return v_id;
end;
$$;

create or replace function public.set_bonus_answer(
  p_comp uuid,
  p_kind text,
  p_answer jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_competition_organizer(p_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;

  -- validate the answer shape/existence for the kind, so a fat-fingered answer
  -- fails loudly instead of silently zeroing the bonus for everyone.
  if p_kind in ('top_scorer', 'top_assists') then
    if public.try_uuid(p_answer ->> 'player_id') is null
       or not exists (
         select 1 from public.tournament_players tp
         where tp.id = public.try_uuid(p_answer ->> 'player_id')
           and tp.competition_id = p_comp
       ) then
      raise exception 'invalid bonus answer (player)' using errcode = '22023';
    end if;
  elsif p_kind = 'tournament_winner' then
    if public.try_uuid(p_answer ->> 'team_id') is null
       or not exists (
         select 1 from public.teams t
         where t.id = public.try_uuid(p_answer ->> 'team_id')
           and t.competition_id = p_comp
       ) then
      raise exception 'invalid bonus answer (team)' using errcode = '22023';
    end if;
  else
    raise exception 'unknown bonus kind' using errcode = '22023';
  end if;

  update public.bonus_questions
    set answer = p_answer
  where competition_id = p_comp and kind = p_kind;
  if not found then
    raise exception 'bonus question not found' using errcode = 'P0002';
  end if;

  insert into public.admin_events (competition_id, actor_user_id, kind, detail)
  values (p_comp, (select auth.uid()), 'bonus_answer_set',
          jsonb_build_object('kind', p_kind, 'answer', p_answer));

  perform public.recompute_competition_scores(p_comp);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.set_bonus_question(uuid, text, timestamptz) to authenticated;
grant execute on function public.set_bonus_answer(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- recompute: match-score + group-ranking + adjustments + bonuses.
-- Bonus match uses try_uuid so any stored payload is crash-proof.
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
  ),
  adj as (
    select member_user_id as user_id, sum(points) as points
    from public.manual_adjustments
    where competition_id = p_comp
    group by member_user_id
  ),
  bn as (
    select
      b.user_id,
      sum(case when b.correct then b.pts else 0 end) as points,
      count(*) filter (where b.correct) as hits
    from (
      select
        pc.user_id,
        (bq.answer is not null and (
          (bq.kind in ('top_scorer', 'top_assists')
           and public.try_uuid(pc.payload ->> 'player_id') is not null
           and public.try_uuid(pc.payload ->> 'player_id') = public.try_uuid(bq.answer ->> 'player_id'))
          or
          (bq.kind = 'tournament_winner'
           and public.try_uuid(pc.payload ->> 'team_id') is not null
           and public.try_uuid(pc.payload ->> 'team_id') = public.try_uuid(bq.answer ->> 'team_id'))
        )) as correct,
        coalesce(
          (v_cfg -> 'bonus' ->> bq.kind)::numeric::int,
          case bq.kind when 'tournament_winner' then 15 else 10 end
        ) as pts
      from public.predictions_current pc
      join public.bonus_questions bq on bq.id = pc.target_id
      where pc.competition_id = p_comp and pc.target_kind = 'bonus'
    ) b
    group by b.user_id
  )
  select
    p_comp,
    cm.user_id,
    coalesce(ms.points, 0) + coalesce(gr.hits, 0) * v_per_position
      + coalesce(adj.points, 0) + coalesce(bn.points, 0),
    jsonb_build_object(
      'exact', coalesce(ms.exact, 0),
      'diff', coalesce(ms.diff, 0),
      'outcome', coalesce(ms.outcome, 0),
      'miss', coalesce(ms.miss, 0),
      'ranking_hits', coalesce(gr.hits, 0),
      'adjustments', coalesce(adj.points, 0),
      'bonus', coalesce(bn.points, 0),
      'bonus_hits', coalesce(bn.hits, 0)
    ),
    now()
  from public.competition_members cm
  left join ms on ms.user_id = cm.user_id
  left join gr on gr.user_id = cm.user_id
  left join adj on adj.user_id = cm.user_id
  left join bn on bn.user_id = cm.user_id
  where cm.competition_id = p_comp
  on conflict (competition_id, user_id) do update
    set points = excluded.points,
        breakdown = excluded.breakdown,
        computed_at = excluded.computed_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- set_scoring_rules: + bonus points section
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
  v_bk text;
  v_bonus jsonb := '{}'::jsonb;
  v_bp int;
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

  foreach v_bk in array array['top_scorer', 'top_assists', 'tournament_winner'] loop
    v_bp := coalesce(
      (p_config -> 'bonus' ->> v_bk)::int,
      case v_bk when 'tournament_winner' then 15 else 10 end
    );
    if v_bp < 0 or v_bp > 100 then
      raise exception 'invalid bonus rule %', v_bk using errcode = '22023';
    end if;
    v_bonus := v_bonus || jsonb_build_object(v_bk, v_bp);
  end loop;
  v_norm := v_norm || jsonb_build_object('bonus', v_bonus);

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
