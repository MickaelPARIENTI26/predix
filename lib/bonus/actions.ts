"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  playerBonusPayloadSchema,
  teamBonusPayloadSchema,
  bonusPicksTeam,
  type BonusKind,
} from "@/lib/schemas/prediction";
import type { SaveOutcome } from "@/lib/predictions/actions";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate(competitionId: string) {
  revalidatePath(`/competitions/${competitionId}/predict`);
  revalidatePath(`/competitions/${competitionId}/results`);
  revalidatePath(`/competitions/${competitionId}/leaderboard`);
}

// --- Player: save a bonus prediction through the generic write door ---------

export type SaveBonusResult =
  | { ok: true; outcome: SaveOutcome; version: number | null }
  | { ok: false; error: string };

export async function saveBonusPrediction(input: {
  questionId: string;
  kind: BonusKind;
  pickId: string;
  baseVersion: number | null;
  eventUuid: string;
  deviceId: string;
  clientSentAt: string;
}): Promise<SaveBonusResult> {
  const payload = bonusPicksTeam(input.kind)
    ? teamBonusPayloadSchema.safeParse({ team_id: input.pickId })
    : playerBonusPayloadSchema.safeParse({ player_id: input.pickId });
  if (!payload.success) return { ok: false, error: "Choix invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_prediction", {
    p_event_uuid: input.eventUuid,
    p_kind: "bonus",
    p_target: input.questionId,
    p_payload: payload.data,
    p_base_version: input.baseVersion ?? undefined,
    p_device_id: input.deviceId,
    p_client_sent_at: input.clientSentAt,
  });
  if (error || !data) return { ok: false, error: "Enregistrement impossible." };

  const result = data as { outcome: SaveOutcome; version?: number; original_outcome?: SaveOutcome };
  const effective =
    result.outcome === "replayed" && result.original_outcome
      ? result.original_outcome
      : result.outcome;
  return { ok: true, outcome: effective, version: result.version ?? null };
}

// --- Organizer: manage bonus questions, answers, players --------------------

export async function setBonusQuestion(
  competitionId: string,
  kind: BonusKind,
  lockAtISO: string
): Promise<ActionResult> {
  if (!lockAtISO) return { ok: false, error: "Date de verrouillage requise." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_bonus_question", {
    p_comp: competitionId,
    p_kind: kind,
    p_lock_at: lockAtISO,
  });
  if (error) return { ok: false, error: "Enregistrement impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function setBonusAnswer(
  competitionId: string,
  kind: BonusKind,
  pickId: string
): Promise<ActionResult> {
  const answer = bonusPicksTeam(kind)
    ? { team_id: pickId }
    : { player_id: pickId };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_bonus_answer", {
    p_comp: competitionId,
    p_kind: kind,
    p_answer: answer,
  });
  if (error) return { ok: false, error: "Réponse invalide (choisis un joueur/équipe)." };
  revalidate(competitionId);
  return { ok: true };
}

export async function addPlayer(
  competitionId: string,
  name: string,
  teamId: string | null
): Promise<ActionResult> {
  if (name.trim().length === 0) return { ok: false, error: "Nom requis." };
  const supabase = await createClient();
  const { error } = await supabase.from("tournament_players").insert({
    competition_id: competitionId,
    name: name.trim().slice(0, 60),
    team_id: teamId,
  });
  if (error) return { ok: false, error: "Ajout impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function removePlayer(
  competitionId: string,
  playerId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("tournament_players")
    .delete()
    .eq("id", playerId);
  if (error) return { ok: false, error: "Suppression impossible." };
  revalidate(competitionId);
  return { ok: true };
}
