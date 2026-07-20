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

export async function addAdjustment(
  competitionId: string,
  memberUserId: string,
  points: number,
  reason: string
): Promise<ActionResult> {
  if (!Number.isInteger(points) || points < -1000 || points > 1000) {
    return { ok: false, error: "Points invalides (−1000 à 1000)." };
  }
  if (reason.trim().length === 0) {
    return { ok: false, error: "Motif obligatoire." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_manual_adjustment", {
    p_comp: competitionId,
    p_member: memberUserId,
    p_points: points,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: "Ajustement impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function removeAdjustment(
  competitionId: string,
  adjustmentId: number
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_manual_adjustment", {
    p_id: adjustmentId,
  });
  if (error) return { ok: false, error: "Suppression impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function setScoringRules(
  competitionId: string,
  config: unknown
): Promise<ActionResult> {
  const parsed = scoringRulesSchema.safeParse(config);
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
