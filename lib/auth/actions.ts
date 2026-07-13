"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import {
  loginSchema,
  signupSchema,
  updateProfileSchema,
} from "@/lib/schemas/auth";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// Prefer a trusted, configured origin for emailed links; fall back to request
// headers only for local dev (never trust x-forwarded-host for security).
async function siteOrigin(): Promise<string> {
  const configured = getEnv().NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return host ? `${proto}://${host}` : "";
}

export async function signIn(
  input: unknown,
  next?: string
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Identifiants invalides." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) return { ok: false, error: "Email ou mot de passe incorrect." };

  redirect(safeNextPath(next));
}

export type SignUpResult =
  | { ok: true; needsConfirmation: boolean }
  | { ok: false; error: string };

export async function signUp(input: unknown): Promise<SignUpResult> {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Informations d'inscription invalides." };
  }

  const supabase = await createClient();
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined,
    },
  });

  if (error) {
    // Give a clear message for a rejected email (invalid domain / no MX), but
    // stay non-enumerating for the "already registered" case.
    if (error.code === "email_address_invalid") {
      return { ok: false, error: "Cette adresse email n'est pas valide." };
    }
    if (error.code === "weak_password") {
      return { ok: false, error: "Mot de passe trop faible." };
    }
    return { ok: false, error: "Inscription impossible avec ces informations." };
  }

  // Session present -> confirmations are off, the user is logged in.
  if (data.session) redirect("/competitions");

  // No session -> a confirmation email was sent.
  return { ok: true, needsConfirmation: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function updateDisplayName(input: unknown): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nom invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expirée." };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.displayName })
    .eq("id", user.id);

  if (error) return { ok: false, error: "Enregistrement impossible." };

  revalidatePath("/profile");
  return { ok: true };
}
