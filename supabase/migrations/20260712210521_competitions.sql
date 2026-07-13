-- Predix — migration 0004: competitions & game data (F2)
--
-- Generic schema (no hardcoded group/team counts): a competition owns its own
-- teams, groups, knockout stages and matches. Predictions/scoring come in F3+.
-- Column names match the F3/F5 design contract in docs/decisions.md
-- (groups.ranking_lock_at, knockout_stages.lock_at) so no rename later.
--
-- Order matters: SQL function bodies are validated at CREATE time, so tables
-- come first, then the membership helpers that query them, then the policies
-- that call the helpers, then triggers and RPCs.
--
-- RLS model:
--   * membership drives reads; organizer role drives game-data writes.
--   * membership checks go through SECURITY DEFINER helpers so
--     competition_members policies don't recurse.
--   * competitions are created/joined only via SECURITY DEFINER RPCs (no direct
--     INSERT grant) — invite-code generation and join-by-code stay controlled.
--   * cross-competition integrity (a match/group_team must not reference a team
--     or group from another competition) is enforced by BEFORE triggers, since
--     plain FKs can't scope to competition_id.
-- Every table enables RLS + explicit GRANTs here (repo convention).

-- ===========================================================================
-- 1. Dependency-free helper
-- ===========================================================================

-- 6-char human-typable code from an unambiguous alphabet (no 0/O/1/I/L).
create or replace function public.gen_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr(
      'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
      1 + floor(random() * length('ABCDEFGHJKMNPQRSTUVWXYZ23456789'))::int,
      1
    ),
    ''
  )
  from generate_series(1, 6);
$$;

-- ===========================================================================
-- 2. Tables (+ RLS enabled + GRANTs; policies added in section 4)
-- ===========================================================================

create table public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique,
  -- RESTRICT: an account that owns a competition can't be deleted until the
  -- competition is transferred or removed. F10 (right-to-erasure) must add a
  -- transfer_competition_owner RPC + a delete-or-transfer flow before wiring
  -- account deletion, or this errors deep inside the auth.users cascade.
  owner_user_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.competitions enable row level security;
grant select, update, delete on public.competitions to authenticated;
grant select, insert, update, delete on public.competitions to service_role;

create table public.competition_members (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'player' check (role in ('organizer', 'player')),
  joined_at timestamptz not null default now(),
  unique (competition_id, user_id)
);
-- (competition_id, user_id) unique index already serves competition_id-prefix
-- lookups; only the reverse (list my competitions) needs its own index.
create index competition_members_user_idx on public.competition_members (user_id);
alter table public.competition_members enable row level security;
-- Membership is created only by the create/join RPCs (SECURITY DEFINER); a
-- member may remove their own row (leave). No direct INSERT for authenticated.
grant select, delete on public.competition_members to authenticated;
grant select, insert, update, delete on public.competition_members to service_role;

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  code text check (code is null or char_length(code) between 1 and 8),
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);
create index teams_competition_idx on public.teams (competition_id);
alter table public.teams enable row level security;
grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.teams to service_role;

-- ranking_lock_at NULL for now = "not set"; F5 resolves the effective lock
-- (explicit value, else the group's first kickoff) and treats it explicitly.
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  ranking_lock_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competition_id, name)
);
create index groups_competition_idx on public.groups (competition_id);
alter table public.groups enable row level security;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, update, delete on public.groups to service_role;

create table public.group_teams (
  group_id uuid not null references public.groups (id) on delete cascade,
  team_id uuid not null references public.teams (id) on delete cascade,
  final_rank smallint,
  primary key (group_id, team_id)
);
alter table public.group_teams enable row level security;
grant select, insert, update, delete on public.group_teams to authenticated;
grant select, insert, update, delete on public.group_teams to service_role;

create table public.knockout_stages (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  kind text not null check (kind in ('round_of_16', 'quarter', 'semi', 'final')),
  lock_at timestamptz,
  created_at timestamptz not null default now(),
  unique (competition_id, kind)
);
create index knockout_stages_competition_idx on public.knockout_stages (competition_id);
alter table public.knockout_stages enable row level security;
grant select, insert, update, delete on public.knockout_stages to authenticated;
grant select, insert, update, delete on public.knockout_stages to service_role;

-- matches.stage is a display/scoring label with more values ('group',
-- 'third_place') than knockout_stages.kind (only the rounds that get a
-- qualified-team prediction) — the divergence is intentional, no FK between
-- them. kickoff_at IS the score-prediction lock; teams nullable for knockout
-- placeholders resolved later.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions (id) on delete cascade,
  stage text not null default 'group'
    check (stage in ('group', 'round_of_16', 'quarter', 'semi', 'third_place', 'final')),
  group_id uuid references public.groups (id) on delete set null,
  home_team_id uuid references public.teams (id) on delete set null,
  away_team_id uuid references public.teams (id) on delete set null,
  label text check (label is null or char_length(label) <= 80),
  kickoff_at timestamptz not null,
  home_score smallint check (home_score is null or home_score >= 0),
  away_score smallint check (away_score is null or away_score >= 0),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'postponed')),
  created_at timestamptz not null default now(),
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id)
);
create index matches_competition_kickoff_idx on public.matches (competition_id, kickoff_at);
create index matches_group_idx on public.matches (group_id);
alter table public.matches enable row level security;
grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update, delete on public.matches to service_role;

-- ===========================================================================
-- 3. Membership helpers (SECURITY DEFINER, bypass RLS to avoid recursion)
-- ===========================================================================
create or replace function public.is_competition_member(p_comp uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_members m
    where m.competition_id = p_comp
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_competition_organizer(p_comp uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.competition_members m
    where m.competition_id = p_comp
      and m.user_id = (select auth.uid())
      and m.role = 'organizer'
  );
$$;

-- ===========================================================================
-- 4. Policies (call the helpers from section 3)
-- ===========================================================================
create policy "competitions_select_members"
  on public.competitions for select to authenticated
  using (public.is_competition_member(id));
create policy "competitions_update_owner"
  on public.competitions for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));
create policy "competitions_delete_owner"
  on public.competitions for delete to authenticated
  using (owner_user_id = (select auth.uid()));

create policy "members_select_comembers"
  on public.competition_members for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "members_delete_self"
  on public.competition_members for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "teams_select_members"
  on public.teams for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "teams_write_organizer"
  on public.teams for all to authenticated
  using (public.is_competition_organizer(competition_id))
  with check (public.is_competition_organizer(competition_id));

create policy "groups_select_members"
  on public.groups for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "groups_write_organizer"
  on public.groups for all to authenticated
  using (public.is_competition_organizer(competition_id))
  with check (public.is_competition_organizer(competition_id));

create policy "group_teams_select_members"
  on public.group_teams for select to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_teams.group_id
        and public.is_competition_member(g.competition_id)
    )
  );
create policy "group_teams_write_organizer"
  on public.group_teams for all to authenticated
  using (
    exists (
      select 1 from public.groups g
      where g.id = group_teams.group_id
        and public.is_competition_organizer(g.competition_id)
    )
  )
  with check (
    exists (
      select 1 from public.groups g
      where g.id = group_teams.group_id
        and public.is_competition_organizer(g.competition_id)
    )
  );

create policy "knockout_stages_select_members"
  on public.knockout_stages for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "knockout_stages_write_organizer"
  on public.knockout_stages for all to authenticated
  using (public.is_competition_organizer(competition_id))
  with check (public.is_competition_organizer(competition_id));

create policy "matches_select_members"
  on public.matches for select to authenticated
  using (public.is_competition_member(competition_id));
create policy "matches_write_organizer"
  on public.matches for all to authenticated
  using (public.is_competition_organizer(competition_id))
  with check (public.is_competition_organizer(competition_id));

-- ===========================================================================
-- 5. Triggers
-- ===========================================================================

-- Cross-competition integrity (FKs can't scope to competition_id).
create or replace function public.check_match_competition_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.group_id is not null and not exists (
    select 1 from public.groups g
    where g.id = new.group_id and g.competition_id = new.competition_id
  ) then
    raise exception 'group_id does not belong to competition %', new.competition_id
      using errcode = '23514';
  end if;
  if new.home_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = new.home_team_id and t.competition_id = new.competition_id
  ) then
    raise exception 'home_team_id does not belong to competition %', new.competition_id
      using errcode = '23514';
  end if;
  if new.away_team_id is not null and not exists (
    select 1 from public.teams t
    where t.id = new.away_team_id and t.competition_id = new.competition_id
  ) then
    raise exception 'away_team_id does not belong to competition %', new.competition_id
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger matches_competition_integrity
  before insert or update on public.matches
  for each row execute function public.check_match_competition_integrity();

create or replace function public.check_group_team_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_comp uuid;
  v_team_comp uuid;
begin
  select competition_id into v_group_comp from public.groups where id = new.group_id;
  select competition_id into v_team_comp from public.teams where id = new.team_id;
  if v_group_comp is null or v_team_comp is null or v_group_comp <> v_team_comp then
    raise exception 'group and team must belong to the same competition'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger group_teams_competition_integrity
  before insert or update on public.group_teams
  for each row execute function public.check_group_team_integrity();

-- Creating a competition makes the owner its organizer member.
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.competition_members (competition_id, user_id, role)
  values (new.id, new.owner_user_id, 'organizer')
  on conflict (competition_id, user_id) do nothing;
  return new;
end;
$$;
create trigger on_competition_created
  after insert on public.competitions
  for each row execute function public.add_owner_as_member();

-- ===========================================================================
-- 6. RPCs: the only write door for competitions & membership
-- ===========================================================================
create or replace function public.create_competition(p_name text)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comp public.competitions;
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_name is null or char_length(trim(p_name)) = 0 then
    raise exception 'name required' using errcode = '22000';
  end if;

  loop
    v_attempt := v_attempt + 1;
    begin
      insert into public.competitions (name, invite_code, owner_user_id)
      values (left(trim(p_name), 80), public.gen_invite_code(), v_uid)
      returning * into v_comp;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then raise; end if;
    end;
  end loop;

  return v_comp;
end;
$$;

create or replace function public.join_competition(p_code text)
returns public.competitions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_comp public.competitions;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_comp
  from public.competitions
  where invite_code = upper(trim(p_code));

  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;

  insert into public.competition_members (competition_id, user_id, role)
  values (v_comp.id, v_uid, 'player')
  on conflict (competition_id, user_id) do nothing;

  return v_comp;
end;
$$;

-- authenticated may only reach competitions/membership through these RPCs and
-- the membership helpers used by policies.
grant execute on function public.create_competition(text) to authenticated;
grant execute on function public.join_competition(text) to authenticated;
grant execute on function public.is_competition_member(uuid) to authenticated;
grant execute on function public.is_competition_organizer(uuid) to authenticated;
