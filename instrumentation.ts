// Runs once at server startup (Next.js instrumentation hook) so the env
// guard in lib/env.ts fires immediately — a production deployment wired to
// the dev Supabase project must die at boot, not at first client creation.
export async function register() {
  (await import("@/lib/env")).getEnv();
}
