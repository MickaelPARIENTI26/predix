-- ---------------------------------------------------------------------------
-- Audit + recompute when a match that carries a RESULT is deleted.
--
-- 0008 forced result WRITES through set_match_result (which appends an
-- admin_events row and recomputes) by revoking direct INSERT/UPDATE on matches.
-- But DELETE was never revoked: an organizer calling the Data API directly
-- (DELETE /rest/v1/matches?id=eq.<finished match>) could silently remove a
-- result — no admin_events row, and the scores cache left stale until some
-- unrelated recompute. That defeats the app's #1 guarantee (audit/reliability).
--
-- The app legitimately deletes SCHEDULED matches (setup edits via deleteMatch,
-- and clearGameData reset), so rather than revoke DELETE we make it
-- self-auditing: deleting a `finished` match logs an event and recomputes;
-- deleting a resultless match stays a silent setup edit (nothing to audit, no
-- score impact — recompute only counts finished matches).
-- ---------------------------------------------------------------------------

-- allow the new audit kind
alter table public.admin_events drop constraint admin_events_kind_check;
alter table public.admin_events add constraint admin_events_kind_check
  check (kind in ('result_set', 'result_cleared', 'scoring_rules_changed',
                  'bonus_question_set', 'bonus_answer_set', 'match_deleted'));

create or replace function public.audit_match_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only a finished match carries a result (set_match_result nulls the scores
  -- for any other status), so only that case affects the audit log / scores.
  -- Guard against cascade deletes: when the parent competition is itself being
  -- removed there is nothing left to audit or recompute, and the admin_events
  -- FK would point at a competition row that no longer exists.
  if old.status = 'finished'
     and exists (select 1 from public.competitions where id = old.competition_id) then
    insert into public.admin_events (competition_id, actor_user_id, kind, target_id, detail)
    values (
      old.competition_id,
      (select auth.uid()),
      'match_deleted',
      old.id,
      jsonb_build_object('home', old.home_score, 'away', old.away_score, 'stage', old.stage)
    );
    perform public.recompute_competition_scores(old.competition_id);
  end if;
  return old;
end;
$$;

create trigger matches_audit_delete
  after delete on public.matches
  for each row execute function public.audit_match_delete();
