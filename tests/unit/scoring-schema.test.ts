import { describe, expect, it } from "vitest";
import {
  scoringRulesSchema,
  phaseRulesSchema,
  matchResultSchema,
  DEFAULT_SCORING_RULES,
  SCORING_PHASES,
} from "@/lib/schemas/scoring";

describe("phaseRulesSchema", () => {
  it("accepts a valid phase barème", () => {
    expect(phaseRulesSchema.parse({ exact: 4, diff: 3, outcome: 2 })).toEqual({
      exact: 4,
      diff: 3,
      outcome: 2,
    });
  });
  it("rejects negatives / non-integers / over 100", () => {
    expect(phaseRulesSchema.safeParse({ exact: -1, diff: 3, outcome: 2 }).success).toBe(false);
    expect(phaseRulesSchema.safeParse({ exact: 1.5, diff: 3, outcome: 2 }).success).toBe(false);
    expect(phaseRulesSchema.safeParse({ exact: 101, diff: 3, outcome: 2 }).success).toBe(false);
  });
});

describe("scoringRulesSchema (3 phases)", () => {
  it("accepts the three phases", () => {
    expect(scoringRulesSchema.safeParse(DEFAULT_SCORING_RULES).success).toBe(true);
  });
  it("rejects a missing phase", () => {
    expect(
      scoringRulesSchema.safeParse({ groups: { exact: 4, diff: 3, outcome: 2 } }).success
    ).toBe(false);
  });
  it("defaults are exact 4 / diff 3 / outcome 2 for every phase", () => {
    for (const p of SCORING_PHASES) {
      expect(DEFAULT_SCORING_RULES[p.key]).toEqual({ exact: 4, diff: 3, outcome: 2 });
    }
  });
});

describe("matchResultSchema", () => {
  it("accepts 0..99 scores", () => {
    expect(matchResultSchema.parse({ home: 5, away: 2 })).toEqual({ home: 5, away: 2 });
  });
  it("rejects out-of-range", () => {
    expect(matchResultSchema.safeParse({ home: 100, away: 0 }).success).toBe(false);
    expect(matchResultSchema.safeParse({ home: -1, away: 0 }).success).toBe(false);
  });
});
