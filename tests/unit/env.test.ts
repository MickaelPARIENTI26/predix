import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://dev-project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
};

describe("parseEnv", () => {
  it("accepts a valid dev configuration", () => {
    const env = parseEnv(valid);
    expect(env.SUPABASE_ENV).toBe("dev");
  });

  it("rejects a missing Supabase URL", () => {
    expect(() =>
      parseEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: valid.NEXT_PUBLIC_SUPABASE_ANON_KEY })
    ).toThrow();
  });

  it("rejects a production deployment wired to the dev project", () => {
    expect(() =>
      parseEnv({ ...valid, VERCEL_ENV: "production", SUPABASE_ENV: "dev" })
    ).toThrow(/dev Supabase project/);
  });

  it("accepts a production deployment wired to the prod project", () => {
    const env = parseEnv({ ...valid, VERCEL_ENV: "production", SUPABASE_ENV: "prod" });
    expect(env.SUPABASE_ENV).toBe("prod");
  });
});
