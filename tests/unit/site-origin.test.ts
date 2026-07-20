import { describe, expect, it } from "vitest";
import { resolveEmailOrigin } from "@/lib/auth/site-origin";

describe("resolveEmailOrigin", () => {
  it("prefers the configured origin and strips a trailing slash", () => {
    expect(resolveEmailOrigin("https://predix.app", "attacker.com", "https")).toBe(
      "https://predix.app"
    );
    expect(resolveEmailOrigin("https://predix.app/", "x", null)).toBe(
      "https://predix.app"
    );
  });

  it("ignores an attacker-controlled host when no origin is configured", () => {
    // The whole point: a poisoned X-Forwarded-Host must NOT become the link base.
    expect(resolveEmailOrigin(undefined, "attacker.com", "https")).toBe("");
    expect(resolveEmailOrigin(undefined, "evil.example.com:443", "https")).toBe("");
    expect(resolveEmailOrigin(undefined, null, null)).toBe("");
  });

  it("trusts only a local dev host for the header fallback", () => {
    expect(resolveEmailOrigin(undefined, "localhost:3100", "http")).toBe(
      "http://localhost:3100"
    );
    expect(resolveEmailOrigin(undefined, "127.0.0.1:3000", null)).toBe(
      "http://127.0.0.1:3000"
    );
    expect(resolveEmailOrigin(undefined, "[::1]:3000", "http")).toBe(
      "http://[::1]:3000"
    );
  });

  it("does not treat a look-alike host as local", () => {
    expect(resolveEmailOrigin(undefined, "localhost.attacker.com", "https")).toBe("");
    expect(resolveEmailOrigin(undefined, "127.0.0.1.attacker.com", "https")).toBe("");
  });
});
