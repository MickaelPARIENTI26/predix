import { describe, expect, it } from "vitest";
import {
  createCompetitionSchema,
  joinCompetitionSchema,
  inviteCodeSchema,
  teamSchema,
} from "@/lib/schemas/competition";

describe("createCompetitionSchema", () => {
  it("trims and accepts a valid name", () => {
    expect(createCompetitionSchema.parse({ name: "  Euro  " }).name).toBe("Euro");
  });
  it("rejects empty and over-long names", () => {
    expect(createCompetitionSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(
      createCompetitionSchema.safeParse({ name: "x".repeat(81) }).success
    ).toBe(false);
  });
});

describe("inviteCodeSchema", () => {
  it("uppercases and accepts a 6-char code", () => {
    expect(inviteCodeSchema.parse(" cu4m8h ")).toBe("CU4M8H");
  });
  it("rejects wrong length or ambiguous chars", () => {
    expect(inviteCodeSchema.safeParse("ABC12").success).toBe(false); // too short
    expect(inviteCodeSchema.safeParse("ABC120").success).toBe(false); // 0 not allowed
    expect(inviteCodeSchema.safeParse("ABCIL1").success).toBe(false); // I/L/1
  });
});

describe("joinCompetitionSchema", () => {
  it("normalizes the code", () => {
    expect(joinCompetitionSchema.parse({ code: "cu4m8h" }).code).toBe("CU4M8H");
  });
});

describe("teamSchema", () => {
  it("accepts a name with optional code", () => {
    const p = teamSchema.parse({ name: "France", code: "fra" });
    expect(p.name).toBe("France");
    expect(p.code).toBe("FRA");
  });
  it("accepts an empty code", () => {
    expect(teamSchema.safeParse({ name: "France", code: "" }).success).toBe(true);
  });
  it("rejects an empty name", () => {
    expect(teamSchema.safeParse({ name: "" }).success).toBe(false);
  });
});
