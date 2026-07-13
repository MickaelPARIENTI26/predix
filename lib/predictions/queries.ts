import { createClient } from "@/lib/supabase/server";

export type MyScorePrediction = {
  matchId: string;
  home: number;
  away: number;
  version: number;
};

/** The current user's own score predictions for a competition, keyed by match.
 *  RLS returns only the caller's own rows. */
export async function getMyScorePredictions(
  competitionId: string
): Promise<Map<string, MyScorePrediction>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("predictions_current")
    .select("target_id, payload, version")
    .eq("competition_id", competitionId)
    .eq("target_kind", "match_score");

  const map = new Map<string, MyScorePrediction>();
  for (const row of data ?? []) {
    const payload = row.payload as { home?: number; away?: number };
    if (typeof payload?.home === "number" && typeof payload?.away === "number") {
      map.set(row.target_id, {
        matchId: row.target_id,
        home: payload.home,
        away: payload.away,
        version: row.version,
      });
    }
  }
  return map;
}
