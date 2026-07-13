"use server";

import { createClient } from "@/lib/supabase/server";
import {
  scorePayloadSchema,
  groupRankingPayloadSchema,
} from "@/lib/schemas/prediction";

export type SaveOutcome =
  | "accepted"
  | "replayed"
  | "rejected_locked"
  | "rejected_conflict"
  | "rejected_invalid";

export type SaveResult =
  | {
      ok: true;
      outcome: SaveOutcome;
      version: number | null;
      serverReceivedAt: string | null;
      lockAt: string | null;
      currentPayload: { home: number; away: number } | null;
      currentVersion: number | null;
    }
  | { ok: false; error: string };

export type SaveScoreInput = {
  matchId: string;
  home: number;
  away: number;
  baseVersion: number | null;
  eventUuid: string;
  deviceId: string;
  clientSentAt: string;
};

/** The single client entry point to the save_prediction write door. Never
 *  trusts the client: the payload is re-validated and the DB RPC validates
 *  again + stamps identity/time server-side. */
export async function saveScorePrediction(
  input: SaveScoreInput
): Promise<SaveResult> {
  const parsed = scorePayloadSchema.safeParse({
    home: input.home,
    away: input.away,
  });
  if (!parsed.success) {
    return { ok: false, error: "Score invalide (0–99)." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_prediction", {
    p_event_uuid: input.eventUuid,
    p_kind: "match_score",
    p_target: input.matchId,
    p_payload: parsed.data,
    p_base_version: input.baseVersion ?? undefined,
    p_device_id: input.deviceId,
    p_client_sent_at: input.clientSentAt,
  });

  if (error || !data) {
    return { ok: false, error: "Enregistrement impossible. Réessaie." };
  }

  const result = data as {
    outcome: SaveOutcome;
    version?: number;
    original_outcome?: SaveOutcome;
    server_received_at?: string;
    lock_at?: string;
    current_payload?: { home: number; away: number };
    current_version?: number;
  };

  // A replay reports the ORIGINAL outcome; surface that so a lost-response
  // retry after kickoff shows "saved", not a fresh "locked".
  const effective =
    result.outcome === "replayed" && result.original_outcome
      ? result.original_outcome
      : result.outcome;

  return {
    ok: true,
    outcome: effective,
    version: result.version ?? null,
    serverReceivedAt: result.server_received_at ?? null,
    lockAt: result.lock_at ?? null,
    currentPayload: result.current_payload ?? null,
    currentVersion: result.current_version ?? null,
  };
}

export type SaveGroupRankingInput = {
  groupId: string;
  ranking: string[];
  baseVersion: number | null;
  eventUuid: string;
  deviceId: string;
  clientSentAt: string;
};

export type SaveRankingResult =
  | { ok: true; outcome: SaveOutcome; version: number | null }
  | { ok: false; error: string };

/** Save a group-ranking prediction through the same write door. */
export async function saveGroupRanking(
  input: SaveGroupRankingInput
): Promise<SaveRankingResult> {
  const parsed = groupRankingPayloadSchema.safeParse({ ranking: input.ranking });
  if (!parsed.success) return { ok: false, error: "Classement invalide." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_prediction", {
    p_event_uuid: input.eventUuid,
    p_kind: "group_ranking",
    p_target: input.groupId,
    p_payload: parsed.data,
    p_base_version: input.baseVersion ?? undefined,
    p_device_id: input.deviceId,
    p_client_sent_at: input.clientSentAt,
  });

  if (error || !data) {
    return { ok: false, error: "Enregistrement impossible. Réessaie." };
  }

  const result = data as { outcome: SaveOutcome; version?: number; original_outcome?: SaveOutcome };
  const effective =
    result.outcome === "replayed" && result.original_outcome
      ? result.original_outcome
      : result.outcome;
  return { ok: true, outcome: effective, version: result.version ?? null };
}
