import { z } from "zod";

/**
 * Environment validation — fails fast on misconfiguration.
 *
 * Single environment for now: one Supabase project backs everything (local,
 * previews, and the production URL). The dev/prod split — and a guard here that
 * refuses a production build wired to the wrong project — comes back when we
 * spin up a clean database for the real launch. See docs/decisions.md.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  // Trusted public origin (e.g. https://predix.app) for emailed links. When
  // unset, actions fall back to request headers (fine for local dev).
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  return envSchema.parse(raw);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });
  return cached;
}
