import { z } from "zod";

/**
 * Environment validation — fails fast on misconfiguration.
 *
 * Topology: two Supabase cloud projects (dev + prod).
 *  - Vercel preview + local dev  -> dev project  (SUPABASE_ENV=dev)
 *  - Vercel production           -> prod project (SUPABASE_ENV=prod)
 *
 * The guard below refuses a production deployment wired to the dev project.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  // Trusted public origin (e.g. https://predix.app) for emailed links. When
  // unset, actions fall back to request headers (fine for local dev).
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  // Which Supabase project these credentials belong to (set per Vercel environment).
  SUPABASE_ENV: z.enum(["dev", "prod"]).default("dev"),
  // Provided by Vercel at build/runtime; absent locally.
  VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const env = envSchema.parse(raw);
  if (env.VERCEL_ENV === "production" && env.SUPABASE_ENV !== "prod") {
    throw new Error(
      "Refusing to run: production deployment is wired to the dev Supabase project (SUPABASE_ENV must be 'prod')."
    );
  }
  return env;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    SUPABASE_ENV: process.env.SUPABASE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
  return cached;
}
