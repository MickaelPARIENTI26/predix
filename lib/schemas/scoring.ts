import { z } from "zod";

/**
 * Per-phase scoring rules (F4.1). Three phases (groups / knockout / final),
 * each with three dimensions applied in a strict cascade:
 *   exact   : exact score
 *   diff    : correct goal difference (implies correct winner)
 *   outcome : correct winner/draw only
 */
export const phaseRulesSchema = z.object({
  exact: z.number().int().min(0).max(100),
  diff: z.number().int().min(0).max(100),
  outcome: z.number().int().min(0).max(100),
});

export const scoringRulesSchema = z.object({
  groups: phaseRulesSchema,
  knockout: phaseRulesSchema,
  final: phaseRulesSchema,
});

export type PhaseRules = z.infer<typeof phaseRulesSchema>;
export type ScoringRules = z.infer<typeof scoringRulesSchema>;

export const DEFAULT_PHASE_RULES: PhaseRules = { exact: 4, diff: 3, outcome: 2 };

export const DEFAULT_SCORING_RULES: ScoringRules = {
  groups: { ...DEFAULT_PHASE_RULES },
  knockout: { ...DEFAULT_PHASE_RULES },
  final: { ...DEFAULT_PHASE_RULES },
};

export const SCORING_PHASES = [
  { key: "groups", label: "Phase de groupes" },
  { key: "knockout", label: "Élimination directe" },
  { key: "final", label: "Finale" },
] as const;

export type ScoringPhaseKey = (typeof SCORING_PHASES)[number]["key"];

/** A single match result (organizer entry). */
export const matchResultSchema = z.object({
  home: z.number().int().min(0).max(99),
  away: z.number().int().min(0).max(99),
});

export type MatchResult = z.infer<typeof matchResultSchema>;
