-- Predix — migration 0014: organizer audit access (F9)
--
-- Dispute resolution: the organizer must be able to read every prediction
-- attempt in their competition (accepted / rejected_locked / rejected_conflict
-- / rejected_invalid) with server timestamps and versions. prediction_events is
-- otherwise own-rows-only; this adds an organizer read path, OR'd with the
-- existing own-rows policy. Members still see only their own attempts; admin_events
-- already has an organizer read policy (migration 0008).

create policy "prediction_events_select_organizer"
  on public.prediction_events for select to authenticated
  using (public.is_competition_organizer(competition_id));
