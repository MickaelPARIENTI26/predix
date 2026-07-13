"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { matchResultSchema, scoringRulesSchema } from "@/lib/schemas/scoring";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate(competitionId: string) {
  revalidatePath(`/competitions/${competitionId}/results`);
  revalidatePath(`/competitions/${competitionId}/leaderboard`);
}

/** Enter/correct a match result through the single audited door. */
export async function setMatchResult(
  competitionId: string,
  matchId: string,
  home: number,
  away: number
): Promise<ActionResult> {
  const parsed = matchResultSchema.safeParse({ home, away });
  if (!parsed.success) return { ok: false, error: "Score invalide (0–99)." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_match_result", {
    p_match: matchId,
    p_home: parsed.data.home,
    p_away: parsed.data.away,
    p_status: "finished",
  });
  if (error) return { ok: false, error: "Enregistrement du résultat impossible." };
  revalidate(competitionId);
  return { ok: true };
}

/** Clear a result (back to scheduled) — drops its points on recompute. */
export async function clearMatchResult(
  competitionId: string,
  matchId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_match_result", {
    p_match: matchId,
    p_home: 0,
    p_away: 0,
    p_status: "scheduled",
  });
  if (error) return { ok: false, error: "Réinitialisation impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function setScoringRules(
  competitionId: string,
  exactScore: number,
  correctOutcome: number
): Promise<ActionResult> {
  const parsed = scoringRulesSchema.safeParse({
    exact_score: exactScore,
    correct_outcome: correctOutcome,
  });
  if (!parsed.success) return { ok: false, error: "Barème invalide." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_scoring_rules", {
    p_comp: competitionId,
    p_config: parsed.data,
  });
  if (error) return { ok: false, error: "Enregistrement du barème impossible." };
  revalidate(competitionId);
  return { ok: true };
}
