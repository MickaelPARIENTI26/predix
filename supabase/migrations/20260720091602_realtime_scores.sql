-- Predix — migration 0013: live leaderboard (F7)
--
-- Broadcast changes to the scores cache over Supabase Realtime so the
-- leaderboard updates without a refresh. RLS still applies to Realtime, so a
-- member only receives changes for competitions they belong to. recompute does
-- DELETE + INSERT, so clients debounce the resulting burst into one refetch.
--
-- replica identity full: recompute's DELETE emits the old row; full identity
-- lets Realtime evaluate the competition_id filter + RLS on delete events.

alter table public.scores replica identity full;
alter publication supabase_realtime add table public.scores;
