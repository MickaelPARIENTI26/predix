// Origin used to build emailed confirmation / recovery links.
//
// The request Host header (x-forwarded-host) is attacker-controllable and must
// never end up in an emailed link — a poisoned host would deliver a victim's
// confirmation token to the attacker (account pre-hijack). So the header is
// trusted only for a local dev host; any other host with no configured origin
// yields "", which makes emailRedirectTo undefined so Supabase falls back to
// its own dashboard-configured (trusted) Site URL.

const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

export function resolveEmailOrigin(
  configured: string | undefined,
  host: string | null,
  proto: string | null
): string {
  if (configured) return configured.replace(/\/$/, "");
  if (host && LOCAL_HOST.test(host)) {
    return `${proto ?? "http"}://${host}`;
  }
  return "";
}
