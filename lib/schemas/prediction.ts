import { z } from "zod";

/** Score prediction payload: home/away goals, 0–99. Validated client + server
 *  (the DB RPC re-validates — never trust the client). */
export const scorePayloadSchema = z.object({
  home: z.number().int().min(0).max(99),
  away: z.number().int().min(0).max(99),
});

export type ScorePayload = z.infer<typeof scorePayloadSchema>;

/** Parse a text input (from a number field) into a score component, or null. */
export function parseScoreInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "" || !/^\d{1,2}$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

/** Bonus payloads: a player pick (top scorer / assists) or a team pick (winner). */
export const playerBonusPayloadSchema = z.object({
  player_id: z.string().uuid(),
});
export const teamBonusPayloadSchema = z.object({
  team_id: z.string().uuid(),
});

export const BONUS_KINDS = [
  "top_scorer",
  "top_assists",
  "tournament_winner",
] as const;
export type BonusKind = (typeof BONUS_KINDS)[number];

export const BONUS_LABELS: Record<BonusKind, string> = {
  top_scorer: "Meilleur buteur",
  top_assists: "Meilleur passeur",
  tournament_winner: "Vainqueur",
};

/** true if the bonus picks a team (winner) rather than a player. */
export function bonusPicksTeam(kind: BonusKind): boolean {
  return kind === "tournament_winner";
}

/** Group-ranking payload: an ordered (best→worst) list of the group's team ids. */
export const groupRankingPayloadSchema = z.object({
  ranking: z.array(z.string().uuid()).min(2).max(8),
});

export type GroupRankingPayload = z.infer<typeof groupRankingPayloadSchema>;

/** Validate a ranking is a complete permutation of exactly `teamIds` (each once). */
export function isCompleteRanking(
  ranking: string[],
  teamIds: string[]
): boolean {
  if (ranking.length !== teamIds.length) return false;
  const set = new Set(teamIds);
  const seen = new Set<string>();
  for (const id of ranking) {
    if (!set.has(id) || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
