import { createClient } from "@/lib/supabase/server";

export type MemberRole = "organizer" | "player";

export type CompetitionSummary = {
  id: string;
  name: string;
  invite_code: string;
  owner_user_id: string;
  created_at: string;
  role: MemberRole;
};

/** Competitions the current user belongs to, with their role. RLS already
 *  restricts rows to the user's own memberships. */
export async function getMyCompetitions(): Promise<CompetitionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("competition_members")
    .select(
      "role, competitions(id, name, invite_code, owner_user_id, created_at)"
    )
    .order("joined_at", { ascending: false });

  if (error || !data) return [];

  return data
    .filter((row) => row.competitions !== null)
    .map((row) => {
      const c = row.competitions as unknown as {
        id: string;
        name: string;
        invite_code: string;
        owner_user_id: string;
        created_at: string;
      };
      return { ...c, role: row.role as MemberRole };
    });
}

export type CompetitionMember = {
  id: string;
  user_id: string;
  role: MemberRole;
  display_name: string;
};

export type CompetitionDetail = {
  id: string;
  name: string;
  invite_code: string;
  owner_user_id: string;
  created_at: string;
  myRole: MemberRole;
  members: CompetitionMember[];
};

/** Full detail for one competition, or null if the user can't see it (RLS). */
export async function getCompetition(
  competitionId: string,
  currentUserId: string
): Promise<CompetitionDetail | null> {
  const supabase = await createClient();

  const { data: comp, error } = await supabase
    .from("competitions")
    .select("id, name, invite_code, owner_user_id, created_at")
    .eq("id", competitionId)
    .single();

  if (error || !comp) return null;

  const { data: memberRows } = await supabase
    .from("competition_members")
    .select("id, user_id, role, profiles(display_name)")
    .eq("competition_id", competitionId)
    .order("joined_at", { ascending: true });

  const members: CompetitionMember[] = (memberRows ?? []).map((m) => {
    const profile = m.profiles as unknown as { display_name: string } | null;
    return {
      id: m.id,
      user_id: m.user_id,
      role: m.role as MemberRole,
      display_name: profile?.display_name ?? "—",
    };
  });

  const myRole =
    members.find((m) => m.user_id === currentUserId)?.role ?? "player";

  return { ...comp, myRole, members };
}
