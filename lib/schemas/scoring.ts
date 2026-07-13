import { z } from "zod";

/** Configurable scoring rules (F4: match scores only). */
export const scoringRulesSchema = z.object({
  exact_score: z.number().int().min(0).max(100),
  correct_outcome: z.number().int().min(0).max(100),
});

export type ScoringRules = z.infer<typeof scoringRulesSchema>;

export const DEFAULT_SCORING_RULES: ScoringRules = {
  exact_score: 3,
  correct_outcome: 1,
};

/** A single match result (organizer entry). */
export const matchResultSchema = z.object({
  home: z.number().int().min(0).max(99),
  away: z.number().int().min(0).max(99),
});

export type MatchResult = z.infer<typeof matchResultSchema>;
