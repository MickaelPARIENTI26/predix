import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
  fieldErrors,
} from "@/lib/schemas/auth";

describe("signupSchema", () => {
  it("accepts valid input and normalizes email/display name", () => {
    const parsed = signupSchema.parse({
      displayName: "  Mika  ",
      email: "  Mika@Example.COM ",
      password: "supersecret",
    });
    expect(parsed.displayName).toBe("Mika");
    expect(parsed.email).toBe("mika@example.com");
  });

  it("rejects a short password", () => {
    const res = signupSchema.safeParse({
      displayName: "Mika",
      email: "a@b.com",
      password: "short",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an empty display name", () => {
    const res = signupSchema.safeParse({
      displayName: "   ",
      email: "a@b.com",
      password: "supersecret",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a display name over 40 chars", () => {
    const res = signupSchema.safeParse({
      displayName: "x".repeat(41),
      email: "a@b.com",
      password: "supersecret",
    });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const res = signupSchema.safeParse({
      displayName: "Mika",
      email: "not-an-email",
      password: "supersecret",
    });
    expect(res.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("requires a non-empty password", () => {
    const res = loginSchema.safeParse({ email: "a@b.com", password: "" });
    expect(res.success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("trims and accepts a valid name", () => {
    const parsed = updateProfileSchema.parse({ displayName: " Léo " });
    expect(parsed.displayName).toBe("Léo");
  });
});

describe("fieldErrors", () => {
  it("maps the first issue per field", () => {
    const res = signupSchema.safeParse({
      displayName: "",
      email: "bad",
      password: "x",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const errs = fieldErrors(res.error);
      expect(errs.displayName).toBeTruthy();
      expect(errs.email).toBeTruthy();
      expect(errs.password).toBeTruthy();
    }
  });
});
