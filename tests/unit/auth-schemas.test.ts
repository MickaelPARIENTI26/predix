import { describe, expect, it } from "vitest";
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
  normalizePhone,
  phoneSchema,
  fieldErrors,
} from "@/lib/schemas/auth";

describe("normalizePhone", () => {
  it("treats a leading 0 as French (+33)", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("07.98.76.54.32")).toBe("+33798765432");
  });
  it("keeps international + numbers", () => {
    expect(normalizePhone("+44 7911 123456")).toBe("+447911123456");
  });
  it("converts 00 prefix to +", () => {
    expect(normalizePhone("0033612345678")).toBe("+33612345678");
  });
  it("rejects junk", () => {
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("phoneSchema", () => {
  it("normalizes valid input", () => {
    expect(phoneSchema.parse("0612345678")).toBe("+33612345678");
  });
  it("rejects invalid input", () => {
    expect(phoneSchema.safeParse("nope").success).toBe(false);
    expect(phoneSchema.safeParse("").success).toBe(false);
  });
});

describe("signupSchema", () => {
  it("accepts valid input and normalizes email/display name/phone", () => {
    const parsed = signupSchema.parse({
      displayName: "  Mika  ",
      phone: "06 12 34 56 78",
      email: "  Mika@Example.COM ",
      password: "supersecret",
    });
    expect(parsed.displayName).toBe("Mika");
    expect(parsed.email).toBe("mika@example.com");
    expect(parsed.phone).toBe("+33612345678");
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
  it("trims and accepts a valid name + phone", () => {
    const parsed = updateProfileSchema.parse({
      displayName: " Léo ",
      phone: "0612345678",
    });
    expect(parsed.displayName).toBe("Léo");
    expect(parsed.phone).toBe("+33612345678");
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
