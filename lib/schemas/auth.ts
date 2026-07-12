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
  email: emailSchema,
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  displayName: displayNameSchema,
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
