import { describe, expect, it } from "vitest";
import {
  scoringRulesSchema,
  matchResultSchema,
  DEFAULT_SCORING_RULES,
} from "@/lib/schemas/scoring";

describe("scoringRulesSchema", () => {
  it("accepts valid rules", () => {
    expect(scoringRulesSchema.parse({ exact_score: 5, correct_outcome: 2 })).toEqual({
      exact_score: 5,
      correct_outcome: 2,
    });
  });
  it("rejects negatives / non-integers / over 100", () => {
    expect(scoringRulesSchema.safeParse({ exact_score: -1, correct_outcome: 1 }).success).toBe(false);
    expect(scoringRulesSchema.safeParse({ exact_score: 1.5, correct_outcome: 1 }).success).toBe(false);
    expect(scoringRulesSchema.safeParse({ exact_score: 101, correct_outcome: 1 }).success).toBe(false);
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_SCORING_RULES).toEqual({ exact_score: 3, correct_outcome: 1 });
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
