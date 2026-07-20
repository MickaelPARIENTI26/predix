import { createClient } from "@/lib/supabase/server";
import type { BonusKind } from "@/lib/schemas/prediction";

export type BonusQuestion = {
  id: string;
  kind: BonusKind;
  lockAt: string | null;
  answer: { player_id?: string; team_id?: string } | null;
};

export async function getBonusQuestions(
  competitionId: string
): Promise<BonusQuestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bonus_questions")
    .select("id, kind, lock_at, answer")
    .eq("competition_id", competitionId);

  return (data ?? []).map((q) => ({
    id: q.id,
    kind: q.kind as BonusKind,
    lockAt: q.lock_at,
    answer: (q.answer ?? null) as BonusQuestion["answer"],
  }));
}

export type TournamentPlayer = { id: string; name: string; teamId: string | null };

export async function getTournamentPlayers(
  competitionId: string
): Promise<TournamentPlayer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_players")
    .select("id, name, team_id")
    .eq("competition_id", competitionId)
    .order("name");
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.team_id,
  }));
}

export type MyBonusPrediction = { targetId: string; pick: string; version: number };

/** The current user's bonus predictions, keyed by bonus_question id. */
export async function getMyBonusPredictions(
  competitionId: string
): Promise<Map<string, MyBonusPrediction>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("predictions_current")
    .select("target_id, payload, version")
    .eq("competition_id", competitionId)
    .eq("target_kind", "bonus");

  const map = new Map<string, MyBonusPrediction>();
  for (const row of data ?? []) {
    const payload = row.payload as { player_id?: string; team_id?: string };
    const pick = payload?.player_id ?? payload?.team_id;
    if (typeof pick === "string") {
      map.set(row.target_id, {
        targetId: row.target_id,
        pick,
        version: row.version,
      });
    }
  }
  return map;
}
