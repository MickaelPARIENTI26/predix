import { createClient } from "@/lib/supabase/server";

export type LeaderboardRow = {
  userId: string;
  displayName: string;
  points: number;
  exact: number;
  outcome: number;
};

/** Members ranked by points. scores is a cache (populated on first recompute);
 *  we left-merge members so everyone appears — at 0 before any result. */
export async function getLeaderboard(
  competitionId: string
): Promise<LeaderboardRow[]> {
  const supabase = await createClient();

  const [membersRes, scoresRes] = await Promise.all([
    supabase
      .from("competition_members")
      .select("user_id, profiles(display_name)")
      .eq("competition_id", competitionId),
    supabase
      .from("scores")
      .select("user_id, points, breakdown")
      .eq("competition_id", competitionId),
  ]);

  const scoreByUser = new Map(
    (scoresRes.data ?? []).map((s) => [s.user_id, s])
  );

  const rows: LeaderboardRow[] = (membersRes.data ?? []).map((m) => {
    const profile = m.profiles as unknown as { display_name: string } | null;
    const s = scoreByUser.get(m.user_id);
    const breakdown = (s?.breakdown ?? {}) as {
      exact?: number;
      outcome?: number;
    };
    return {
      userId: m.user_id,
      displayName: profile?.display_name ?? "—",
      points: s?.points ?? 0,
      exact: breakdown.exact ?? 0,
      outcome: breakdown.outcome ?? 0,
    };
  });

  rows.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
  return rows;
}

export type ScoringRules = { exact_score: number; correct_outcome: number };

/** The competition's scoring rules, or the defaults if none set yet. */
export async function getScoringRules(
  competitionId: string
): Promise<ScoringRules> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scoring_rules")
    .select("config")
    .eq("competition_id", competitionId)
    .maybeSingle();

  const config = (data?.config ?? {}) as Partial<ScoringRules>;
  return {
    exact_score: config.exact_score ?? 3,
    correct_outcome: config.correct_outcome ?? 1,
  };
}
