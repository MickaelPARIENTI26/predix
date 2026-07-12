import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/safe-redirect";

describe("safeNextPath", () => {
  it("keeps a plain internal path", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/competitions/123")).toBe("/competitions/123");
    expect(safeNextPath("/profile?tab=1")).toBe("/profile?tab=1");
  });

  it("falls back for empty / non-string input", () => {
    expect(safeNextPath(undefined)).toBe("/profile");
    expect(safeNextPath("")).toBe("/profile");
    expect(safeNextPath(42)).toBe("/profile");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeNextPath("https://evil.com")).toBe("/profile");
    expect(safeNextPath("//evil.com")).toBe("/profile");
    expect(safeNextPath("http://evil.com/path")).toBe("/profile");
  });

  it("rejects the backslash open-redirect bypass", () => {
    // "/\\evil.com" normalizes to "//evil.com" in browsers -> external host.
    expect(safeNextPath("/\\evil.com")).toBe("/profile");
    expect(safeNextPath("/\\/evil.com")).toBe("/profile");
  });
});
