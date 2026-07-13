import { describe, expect, it } from "vitest";
import { scorePayloadSchema, parseScoreInput } from "@/lib/schemas/prediction";

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
