-- Predix — migration 0007: prediction core (F3, THE critical sprint)
--
-- The whole reliability/audit story lives here. ONE write door
-- (save_prediction) writes an append-only prediction_events log + a
-- predictions_current projection in the same transaction. Every business
-- outcome that reaches Postgres — accepted, locked-out, conflicting, invalid —
-- leaves a row stamped with the SERVER clock.
--
-- Generic over prediction kinds (match_score ships in F3; group_ranking /
-- qualified_teams / bonus reuse the same door in F5/F6). Score payload:
-- {"home": int 0..99, "away": int 0..99}.
--
-- AUDIT BOUNDARIES (intentional, per docs/decisions.md + F3 review):
--  * Only BUSINESS outcomes leave evidence. Precondition RAISEs (not
--    authenticated / unknown kind / unknown target / not a member / idempotency
--    key reused for another target) and infrastructure failures (DB error,
--    serialization failure, timeout, crash) roll back and leave NO row — a
--    rolled-back tx cannot commit its own failure evidence. The client's
--    idempotent retry (same event_uuid) covers transient infra failures.
--  * "Arrived after closing" (Q5) is answered by the predicate
--    server_received_at >= lock_at across ALL outcomes, NOT by the
--    'rejected_locked' label alone (an invalid payload sent after kickoff is
--    stamped 'rejected_invalid').
--  * Correctness relies on READ COMMITTED isolation (PostgREST default): the
--    advisory lock serializes execution, and the post-lock projection read must
--    see the winner's committed version. Do not run this function under
--    REPEATABLE READ / SERIALIZABLE.
--  * Reveal model: prediction_events is readable ONLY for one's own rows (+
--    service_role for admin/dispute views in F9). Co-members see each other's
--    FINAL prediction via predictions_current AFTER the live lock — not the raw
--    attempt history / device ids.
--  * Live lock: a genuine postponement (kickoff moved later) reopens the
--    prediction until the new kickoff and re-hides it — this is intended.

-- ===========================================================================
-- 1. Tables
-- ===========================================================================

-- Append-only source of truth. Never updated (trigger-enforced); deletions
-- happen only via FK cascade / service_role (competition removal, erasure).
create table public.prediction_events (
  id bigint generated always as identity primary key,   -- total order of attempts
  event_uuid uuid not null,                             -- client idempotency key (one per save INTENT)
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_kind text not null
    check (target_kind in ('match_score', 'group_ranking', 'qualified_teams', 'bonus')),
  target_id uuid not null,
  payload jsonb not null,
  outcome text not null
    check (outcome in ('accepted', 'rejected_locked', 'rejected_conflict', 'rejected_invalid')),
  base_version int,                 -- version the client believed it was editing
  resulting_version int,            -- set when outcome = 'accepted'
  conflict_current_version int,     -- set on rejected_conflict: the version the winner held
  previous_payload jsonb,           -- the winning payload on a conflict (self-contained evidence)
  lock_at timestamptz,              -- the deadline in force at write time, snapshotted as evidence
  server_received_at timestamptz not null,  -- := the same clock value used for the lock comparison
  client_sent_at timestamptz,       -- forensic hint only, never used for enforcement
  device_id text,                   -- client-asserted; corroborating, not authoritative
  unique (user_id, event_uuid)
);

create index prediction_events_target_idx
  on public.prediction_events (user_id, target_kind, target_id, id);
create index prediction_events_competition_idx
  on public.prediction_events (competition_id, target_kind, target_id);

alter table public.prediction_events enable row level security;
grant select on public.prediction_events to authenticated;
grant select, insert, update, delete on public.prediction_events to service_role;

-- Derived projection: the latest accepted prediction per (user, target).
-- Written ONLY by save_prediction, in the same transaction as the event.
create table public.predictions_current (
  competition_id uuid not null references public.competitions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_kind text not null,
  target_id uuid not null,
  payload jsonb not null,
  version int not null,
  last_event_id bigint not null references public.prediction_events (id),
  updated_at timestamptz not null default now(),
  primary key (user_id, target_kind, target_id)
);

create index predictions_current_competition_idx
  on public.predictions_current (competition_id, target_kind, target_id);

alter table public.predictions_current enable row level security;
grant select on public.predictions_current to authenticated;
grant select, insert, update, delete on public.predictions_current to service_role;

-- ===========================================================================
-- 2. Immutability: prediction_events rows never change.
--    BEFORE UPDATE only — DELETE is left to FK cascade / service_role so that
--    a competition (with predictions) can still be deleted and erasure works.
--    authenticated has no DELETE grant, so users cannot delete either way.
-- ===========================================================================
create or replace function public.forbid_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'prediction_events is append-only';
end;
$$;

create trigger prediction_events_no_update
  before update on public.prediction_events
  for each row execute function public.forbid_event_mutation();

-- ===========================================================================
-- 3. Resolvers (STABLE, SECURITY DEFINER)
-- ===========================================================================
-- Single source of deadline truth: used by save_prediction (snapshotted into
-- the event) AND by the reveal-after-lock policy. Resolved LIVE from the target
-- so a reschedule moves the deadline. NULL = "no deadline resolvable yet" →
-- callers treat it as locked/closed (never as open).
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
    else null  -- 'bonus' arrives in F6
  end;
$$;

-- Called by the RLS policy (evaluated as the querying role) and by the RPC, so
-- authenticated needs EXECUTE. This lets a caller learn a target's kickoff even
-- for a competition they're not in — accepted: target ids are unguessable uuids
-- and kickoff times are not sensitive.
grant execute on function public.prediction_lock_at(text, uuid) to authenticated;

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
    else null
  end;
$$;

-- ===========================================================================
-- 4. RLS
-- ===========================================================================
-- prediction_events: own rows only. Co-members never read each other's raw
-- attempt history; admin/dispute views (F9) use service_role.
create policy "prediction_events_select_own"
  on public.prediction_events for select to authenticated
  using (user_id = (select auth.uid()));

-- predictions_current: own rows always; co-members' final prediction only
-- AFTER the live lock (transparency once nobody can still change theirs).
create policy "predictions_current_select"
  on public.predictions_current for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      public.is_competition_member(competition_id)
      and public.prediction_lock_at(target_kind, target_id) is not null
      and now() >= public.prediction_lock_at(target_kind, target_id)
    )
  );

-- ===========================================================================
-- 5. save_prediction — the ONE write door
-- ===========================================================================
-- Check order is a correctness requirement (docs/decisions.md):
--   membership → idempotent replay (BEFORE lock) → advisory lock → clock →
--   validation → lock → version check → write. Business rejections RETURN a
--   status (never RAISE) so the evidence row commits.
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
  v_now timestamptz;      -- set AFTER the advisory lock (clock_timestamp), so a
                          -- save blocked behind another is judged at its REAL
                          -- decision time, not transaction start.
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

  -- (2) idempotent replay — BEFORE the lock gate so a lost-response retry that
  --     straddles kickoff returns the original outcome, not a false 'locked'.
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

  -- (3) serialize all saves for this (user, target) — FOR UPDATE alone locks
  --     nothing when the row doesn't exist yet, so the create race needs this.
  perform pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':' || p_kind || ':' || p_target::text, 0)
  );

  -- (4) one clock, captured once here (after the lock wait), used for both the
  --     lock ruling and every server_received_at/lock_at stamp.
  v_now := clock_timestamp();

  -- (5) semantic payload validation (match_score for F3). Range-check on
  --     numeric, never int4 — an oversized integer must fall through to
  --     rejected_invalid, not overflow-crash and roll back with no evidence.
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
    -- first save: a client claiming a non-zero base_version is out of sync
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

  -- (8) write the accepted event, then upsert the projection to point at it
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
  -- concurrent retry with the same event_uuid: the other tx won the unique
  -- constraint; re-read and return its stored outcome instead of erroring.
  when unique_violation then
    select * into v_prior
    from public.prediction_events
    where user_id = v_uid and event_uuid = p_event_uuid
    order by id desc
    limit 1;
    if found then
      -- same guard as step (2): a key reused for a different target must not
      -- return the other target's outcome and silently drop this write.
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

grant execute on function public.save_prediction(uuid, text, uuid, jsonb, int, text, timestamptz) to authenticated;
