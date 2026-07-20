import { describe, expect, it } from "vitest";
import {
  scorePayloadSchema,
  parseScoreInput,
  groupRankingPayloadSchema,
  isCompleteRanking,
  playerBonusPayloadSchema,
  teamBonusPayloadSchema,
  bonusPicksTeam,
} from "@/lib/schemas/prediction";

describe("bonus payloads", () => {
  const U = "11111111-1111-4111-8111-111111111111";
  it("player bonus needs a uuid player_id", () => {
    expect(playerBonusPayloadSchema.safeParse({ player_id: U }).success).toBe(true);
    expect(playerBonusPayloadSchema.safeParse({ player_id: "x" }).success).toBe(false);
  });
  it("team bonus needs a uuid team_id", () => {
    expect(teamBonusPayloadSchema.safeParse({ team_id: U }).success).toBe(true);
    expect(teamBonusPayloadSchema.safeParse({ player_id: U }).success).toBe(false);
  });
  it("only the winner bonus picks a team", () => {
    expect(bonusPicksTeam("tournament_winner")).toBe(true);
    expect(bonusPicksTeam("top_scorer")).toBe(false);
    expect(bonusPicksTeam("top_assists")).toBe(false);
  });
});

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("groupRankingPayloadSchema", () => {
  it("accepts an array of uuids", () => {
    expect(groupRankingPayloadSchema.parse({ ranking: [A, B] }).ranking).toEqual([A, B]);
  });
  it("rejects non-uuid elements", () => {
    expect(groupRankingPayloadSchema.safeParse({ ranking: ["x", B] }).success).toBe(false);
  });
});

describe("isCompleteRanking", () => {
  it("accepts an exact permutation of the group teams", () => {
    expect(isCompleteRanking([C, A, B], [A, B, C])).toBe(true);
  });
  it("rejects wrong size, duplicates, or foreign ids", () => {
    expect(isCompleteRanking([A, B], [A, B, C])).toBe(false); // too short
    expect(isCompleteRanking([A, A, B], [A, B, C])).toBe(false); // duplicate
    expect(isCompleteRanking([A, B, "44444444-4444-4444-8444-444444444444"], [A, B, C])).toBe(false); // foreign
  });
});

describe("scorePayloadSchema", () => {
  it("accepts a valid score", () => {
    expect(scorePayloadSchema.parse({ home: 2, away: 1 })).toEqual({
      home: 2,
      away: 1,
    });
  });
  it("rejects negatives, non-integers and out-of-range", () => {
    expect(scorePayloadSchema.safeParse({ home: -1, away: 0 }).success).toBe(false);
    expect(scorePayloadSchema.safeParse({ home: 1.5, away: 0 }).success).toBe(false);
    expect(scorePayloadSchema.safeParse({ home: 100, away: 0 }).success).toBe(false);
  });
  it("rejects missing fields", () => {
    expect(scorePayloadSchema.safeParse({ home: 1 }).success).toBe(false);
  });
});

describe("parseScoreInput", () => {
  it("parses 0–99", () => {
    expect(parseScoreInput("0")).toBe(0);
    expect(parseScoreInput(" 12 ")).toBe(12);
    expect(parseScoreInput("99")).toBe(99);
  });
  it("rejects blanks, junk, and out-of-range", () => {
    expect(parseScoreInput("")).toBeNull();
    expect(parseScoreInput("a")).toBeNull();
    expect(parseScoreInput("100")).toBeNull();
    expect(parseScoreInput("-1")).toBeNull();
  });
});
