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
