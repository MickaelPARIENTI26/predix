import { z } from "zod";

/** Competition creation / join / game-data validation (client + server). */

export const competitionNameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est obligatoire.")
  .max(80, "80 caractères maximum.");

// Invite code: 6 chars from the unambiguous alphabet the DB generates
// (no 0/O/1/I/L). We uppercase and strip spaces before validating.
export const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/, "Code à 6 caractères.");

export const createCompetitionSchema = z.object({
  name: competitionNameSchema,
});

export const joinCompetitionSchema = z.object({
  code: inviteCodeSchema,
});

export const teamSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(60, "60 caractères max."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .max(8, "8 caractères max.")
    .optional()
    .or(z.literal("")),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(40, "40 caractères max."),
});

export const MATCH_STAGES = [
  "group",
  "round_of_16",
  "quarter",
  "semi",
  "third_place",
  "final",
] as const;

export const matchSchema = z.object({
  stage: z.enum(MATCH_STAGES).default("group"),
  homeTeamId: z.string().uuid().optional(),
  awayTeamId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  // ISO string in UTC; the UI collects local time and converts.
  kickoffAt: z.string().datetime({ message: "Date/heure invalide." }),
});

export type CreateCompetitionInput = z.infer<typeof createCompetitionSchema>;
export type JoinCompetitionInput = z.infer<typeof joinCompetitionSchema>;
export type TeamInput = z.infer<typeof teamSchema>;
export type GroupInput = z.infer<typeof groupSchema>;
export type MatchInput = z.infer<typeof matchSchema>;
