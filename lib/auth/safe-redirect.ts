/**
 * Returns `next` only if it is a safe same-app relative path, else "/profile".
 *
 * Rejects the open-redirect vectors: absolute URLs, protocol-relative "//host",
 * and backslash tricks ("/\\evil.com" — browsers and the WHATWG URL parser
 * treat "\\" as "/", so it normalizes to "//evil.com" → external host).
 * The final URL-resolve step is a belt-and-suspenders check that no authority
 * survived. Shared by the login action and the /auth/confirm route.
 */
export function safeNextPath(next: unknown): string {
  const fallback = "/competitions";
  if (typeof next !== "string" || next.length === 0) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  try {
    const url = new URL(next, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
