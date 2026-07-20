-- ---------------------------------------------------------------------------
-- Enforce "the owner cannot leave" at the database layer.
--
-- leaveCompetition() blocks the owner in app code, but the RLS delete policy
-- allowed any member to delete their own row on user_id = auth.uid() alone.
-- An owner calling the API directly could then delete their own membership and
-- orphan the competition: owner_user_id still points at them, but they are no
-- longer a member, so is_competition_member / is_competition_organizer both go
-- false and they lose read + management of their own competition (recoverable
-- only via delete). Business invariants belong in the database, not only in the
-- app — so make the owner's own membership row undeletable here. Other members
-- can still leave; the owner must delete the whole competition (which cascades).
-- ---------------------------------------------------------------------------

drop policy if exists "members_delete_self" on public.competition_members;

create policy "members_delete_self"
  on public.competition_members for delete to authenticated
  using (
    user_id = (select auth.uid())
    and not exists (
      select 1
      from public.competitions c
      where c.id = competition_id
        and c.owner_user_id = (select auth.uid())
    )
  );
