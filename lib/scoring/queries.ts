import { createClient } from "@/lib/supabase/server";

export type LeaderboardRow = {
  userId: string;
  displayName: string;
  points: number;
  exact: number;
  diff: number;
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
      diff?: number;
      outcome?: number;
    };
    return {
      userId: m.user_id,
      displayName: profile?.display_name ?? "—",
      points: s?.points ?? 0,
      exact: breakdown.exact ?? 0,
      diff: breakdown.diff ?? 0,
      outcome: breakdown.outcome ?? 0,
    };
  });

  rows.sort((a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName));
  return rows;
}

import {
  type ScoringRules,
  type PhaseRules,
  DEFAULT_PHASE_RULES,
  SCORING_PHASES,
} from "@/lib/schemas/scoring";

/** The competition's per-phase scoring rules, or the defaults if none set. */
export async function getScoringRules(
  competitionId: string
): Promise<ScoringRules> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("scoring_rules")
    .select("config")
    .eq("competition_id", competitionId)
    .maybeSingle();

  const config = (data?.config ?? {}) as Record<string, Partial<PhaseRules>>;
  const phase = (key: string): PhaseRules => ({
    exact: config[key]?.exact ?? DEFAULT_PHASE_RULES.exact,
    diff: config[key]?.diff ?? DEFAULT_PHASE_RULES.diff,
    outcome: config[key]?.outcome ?? DEFAULT_PHASE_RULES.outcome,
  });
  return {
    groups: phase(SCORING_PHASES[0].key),
    knockout: phase(SCORING_PHASES[1].key),
    final: phase(SCORING_PHASES[2].key),
  };
}
