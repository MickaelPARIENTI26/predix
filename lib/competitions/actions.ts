"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  createCompetitionSchema,
  joinCompetitionSchema,
} from "@/lib/schemas/competition";

export type CreateResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function createCompetition(input: unknown): Promise<CreateResult> {
  const parsed = createCompetitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Nom de compétition invalide." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_competition", {
    p_name: parsed.data.name,
  });

  if (error || !data) {
    return { ok: false, error: "Création impossible. Réessaie." };
  }

  return { ok: true, id: data.id };
}

export type JoinResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function joinCompetition(input: unknown): Promise<JoinResult> {
  const parsed = joinCompetitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Code à 6 caractères." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_competition", {
    p_code: parsed.data.code,
  });

  if (error || !data) {
    return { ok: false, error: "Code invalide ou compétition introuvable." };
  }

  return { ok: true, id: data.id };
}

/** A player leaves a competition. The owner cannot leave (must delete). */
export async function leaveCompetition(competitionId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: comp } = await supabase
    .from("competitions")
    .select("owner_user_id")
    .eq("id", competitionId)
    .single();

  // Owner leaving would orphan the competition — block it (UI offers delete).
  if (comp && comp.owner_user_id === user.id) {
    redirect(`/competitions/${competitionId}`);
  }

  await supabase
    .from("competition_members")
    .delete()
    .eq("competition_id", competitionId)
    .eq("user_id", user.id);

  revalidatePath("/competitions");
  redirect("/competitions");
}

/** The owner deletes a competition (cascades to all its game data). */
export async function deleteCompetition(competitionId: string): Promise<void> {
  const supabase = await createClient();
  // RLS competitions_delete_owner ensures only the owner can delete.
  await supabase.from("competitions").delete().eq("id", competitionId);
  revalidatePath("/competitions");
  redirect("/competitions");
}
