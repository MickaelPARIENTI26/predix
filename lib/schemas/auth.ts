import { z } from "zod";

/**
 * Auth validation — used on BOTH sides:
 *  - client: parse on submit to show inline errors before hitting the server;
 *  - server: the Server Action re-parses (never trust the client).
 */

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire.")
  .max(40, "40 caractères maximum.");

/**
 * Normalize a phone number to E.164. French-friendly: a leading 0 is assumed
 * to be a French number (+33). International numbers must start with + or 00.
 * Returns null if it can't be made into a plausible E.164 number.
 * (F8/WhatsApp can swap this for libphonenumber-js for full i18n coverage.)
 */
export function normalizePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s.\-()]/g, "");
  let e164: string;
  if (cleaned.startsWith("+")) e164 = cleaned;
  else if (cleaned.startsWith("00")) e164 = "+" + cleaned.slice(2);
  else if (cleaned.startsWith("0")) e164 = "+33" + cleaned.slice(1);
  else return null;
  return /^\+[1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Le numéro de téléphone est obligatoire.")
  .transform((v, ctx) => {
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({
        code: "custom",
        message: "Numéro de téléphone invalide (ex. 06 12 34 56 78).",
      });
      return z.NEVER;
    }
    return normalized;
  });

// Backend minimum is Supabase's (6); we ask a bit more. Stricter than the
// backend is always safe.
const passwordSchema = z
  .string()
  .min(8, "Au moins 8 caractères.")
  .max(72, "72 caractères maximum."); // bcrypt hard limit

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Adresse email invalide.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Le mot de passe est obligatoire."),
});

export const signupSchema = z.object({
  displayName: displayNameSchema,
  phone: phoneSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
  phone: phoneSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/** Flatten a ZodError into a { field: firstMessage } map for form display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !(key in out)) {
      out[key] = issue.message;
    }
  }
  return out;
}
