import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/env";

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "a".repeat(40),
};

describe("parseEnv", () => {
  it("accepts a valid configuration", () => {
    const env = parseEnv(valid);
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://project.supabase.co");
  });

  it("rejects a missing Supabase URL", () => {
    expect(() =>
      parseEnv({
        NEXT_PUBLIC_SUPABASE_ANON_KEY: valid.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      })
    ).toThrow();
  });

  it("rejects a non-URL Supabase URL", () => {
    expect(() => parseEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "nope" })).toThrow();
  });

  it("accepts an optional site URL", () => {
    const env = parseEnv({ ...valid, NEXT_PUBLIC_SITE_URL: "https://predix.app" });
    expect(env.NEXT_PUBLIC_SITE_URL).toBe("https://predix.app");
  });
});
