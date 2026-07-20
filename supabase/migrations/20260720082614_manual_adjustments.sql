-- Predix — migration 0011: manual adjustments (F6, part 1)
--
-- The organizer can award bonus / malus points to a member with a required
-- reason. Each adjustment is a row (its own audit: created_by, created_at,
-- reason). Added/removed only through SECURITY DEFINER RPCs; recompute folds
-- the sum into every member's total. Members can read adjustments (a malus is
-- transparent — you see why).

create table public.manual_adjustments (
  id bigint generated always as identity primary key,
  competition_id uuid not null references public.competitions (id) on delete cascade,
  member_user_id uuid not null references public.profiles (id) on delete cascade,
  points int not null,               -- positive (bonus) or negative (malus)
  reason text not null check (char_length(reason) between 1 and 200),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index manual_adjustments_competition_idx
  on public.manual_adjustments (competition_id);

alter table public.manual_adjustments enable row level security;
grant select on public.manual_adjustments to authenticated;
grant select, insert, update, delete on public.manual_adjustments to service_role;

create policy "manual_adjustments_select_members"
  on public.manual_adjustments for select to authenticated
  using (public.is_competition_member(competition_id));
-- writes go through the RPCs (SECURITY DEFINER); no direct grant.

-- ---------------------------------------------------------------------------
-- Add / remove (organizer-only)
-- ---------------------------------------------------------------------------
create or replace function public.add_manual_adjustment(
  p_comp uuid,
  p_member uuid,
  p_points int,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not public.is_competition_organizer(p_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;
  if p_points is null or p_points < -1000 or p_points > 1000 then
    raise exception 'points out of range' using errcode = '22003';
  end if;
  if p_reason is null or char_length(trim(p_reason)) = 0 then
    raise exception 'reason required' using errcode = '22000';
  end if;
  if not exists (
    select 1 from public.competition_members m
    where m.competition_id = p_comp and m.user_id = p_member
  ) then
    raise exception 'target is not a member' using errcode = '42501';
  end if;

  insert into public.manual_adjustments (competition_id, member_user_id, points, reason, created_by)
  values (p_comp, p_member, p_points, left(trim(p_reason), 200), v_uid);

  perform public.recompute_competition_scores(p_comp);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_manual_adjustment(p_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comp uuid;
begin
  select competition_id into v_comp from public.manual_adjustments where id = p_id;
  if v_comp is null then
    raise exception 'adjustment not found' using errcode = 'P0002';
  end if;
  if not public.is_competition_organizer(v_comp) then
    raise exception 'not organizer' using errcode = '42501';
  end if;

  delete from public.manual_adjustments where id = p_id;
  perform public.recompute_competition_scores(v_comp);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.add_manual_adjustment(uuid, uuid, int, text) to authenticated;
grant execute on function public.remove_manual_adjustment(bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- recompute: match-score (per phase) + group-ranking + manual adjustments.
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
  )
  select
    p_comp,
    cm.user_id,
    coalesce(ms.points, 0) + coalesce(gr.hits, 0) * v_per_position + coalesce(adj.points, 0),
    jsonb_build_object(
      'exact', coalesce(ms.exact, 0),
      'diff', coalesce(ms.diff, 0),
      'outcome', coalesce(ms.outcome, 0),
      'miss', coalesce(ms.miss, 0),
      'ranking_hits', coalesce(gr.hits, 0),
      'adjustments', coalesce(adj.points, 0)
    ),
    now()
  from public.competition_members cm
  left join ms on ms.user_id = cm.user_id
  left join gr on gr.user_id = cm.user_id
  left join adj on adj.user_id = cm.user_id
  where cm.competition_id = p_comp
  on conflict (competition_id, user_id) do update
    set points = excluded.points,
        breakdown = excluded.breakdown,
        computed_at = excluded.computed_at;
end;
$$;
