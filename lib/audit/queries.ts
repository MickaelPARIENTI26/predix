import { createClient } from "@/lib/supabase/server";
import { BONUS_LABELS, type BonusKind } from "@/lib/schemas/prediction";

export type AdminEvent = {
  id: number;
  kind: string;
  actorName: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

const ADMIN_KIND_LABELS: Record<string, string> = {
  result_set: "Résultat saisi",
  result_cleared: "Résultat effacé",
  scoring_rules_changed: "Barème modifié",
  bonus_question_set: "Bonus configuré",
  bonus_answer_set: "Réponse bonus",
};

export function adminKindLabel(kind: string): string {
  return ADMIN_KIND_LABELS[kind] ?? kind;
}

/** Organizer-readable log of admin actions (results, scoring, bonus). */
export async function getAdminEvents(
  competitionId: string
): Promise<AdminEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_events")
    .select("id, kind, detail, created_at, profiles(display_name)")
    .eq("competition_id", competitionId)
    .order("id", { ascending: false });

  return (data ?? []).map((e) => {
    const p = e.profiles as unknown as { display_name: string } | null;
    return {
      id: e.id,
      kind: e.kind,
      actorName: p?.display_name ?? "—",
      detail: (e.detail ?? {}) as Record<string, unknown>,
      createdAt: e.created_at,
    };
  });
}

export type AuditEvent = {
  id: number;
  memberName: string;
  targetKind: string;
  targetLabel: string;
  outcome: string;
  baseVersion: number | null;
  resultingVersion: number | null;
  serverReceivedAt: string;
  deviceId: string | null;
};

export type PredictionAudit = {
  events: AuditEvent[];
  summary: { accepted: number; late: number; conflicts: number; invalid: number };
};

const KIND_LABELS: Record<string, string> = {
  match_score: "Score",
  group_ranking: "Classement",
  qualified_teams: "Qualifiés",
  bonus: "Bonus",
};

/** Every prediction attempt in the competition (organizer only), with resolved
 *  target labels and a summary of late attempts / conflicts. */
export async function getPredictionAudit(
  competitionId: string
): Promise<PredictionAudit> {
  const supabase = await createClient();

  const [eventsRes, teamsRes, matchesRes, groupsRes, bonusRes] =
    await Promise.all([
      supabase
        .from("prediction_events")
        .select(
          "id, target_kind, target_id, outcome, base_version, resulting_version, server_received_at, device_id, profiles(display_name)"
        )
        .eq("competition_id", competitionId)
        .order("id", { ascending: false })
        .limit(500),
      supabase.from("teams").select("id, name").eq("competition_id", competitionId),
      supabase
        .from("matches")
        .select("id, home_team_id, away_team_id")
        .eq("competition_id", competitionId),
      supabase.from("groups").select("id, name").eq("competition_id", competitionId),
      supabase
        .from("bonus_questions")
        .select("id, kind")
        .eq("competition_id", competitionId),
    ]);

  const teamName = new Map((teamsRes.data ?? []).map((t) => [t.id, t.name]));
  const matchLabel = new Map(
    (matchesRes.data ?? []).map((m) => [
      m.id,
      `${teamName.get(m.home_team_id ?? "") ?? "?"} – ${teamName.get(m.away_team_id ?? "") ?? "?"}`,
    ])
  );
  const groupName = new Map((groupsRes.data ?? []).map((g) => [g.id, g.name]));
  const bonusLabel = new Map(
    (bonusRes.data ?? []).map((b) => [b.id, BONUS_LABELS[b.kind as BonusKind] ?? "Bonus"])
  );

  function label(kind: string, targetId: string): string {
    if (kind === "match_score") return matchLabel.get(targetId) ?? "Match";
    if (kind === "group_ranking") return groupName.get(targetId) ?? "Groupe";
    if (kind === "bonus") return bonusLabel.get(targetId) ?? "Bonus";
    return KIND_LABELS[kind] ?? kind;
  }

  const events: AuditEvent[] = (eventsRes.data ?? []).map((e) => {
    const p = e.profiles as unknown as { display_name: string } | null;
    return {
      id: e.id,
      memberName: p?.display_name ?? "—",
      targetKind: KIND_LABELS[e.target_kind] ?? e.target_kind,
      targetLabel: label(e.target_kind, e.target_id),
      outcome: e.outcome,
      baseVersion: e.base_version,
      resultingVersion: e.resulting_version,
      serverReceivedAt: e.server_received_at,
      deviceId: e.device_id,
    };
  });

  const summary = {
    accepted: events.filter((e) => e.outcome === "accepted").length,
    late: events.filter((e) => e.outcome === "rejected_locked").length,
    conflicts: events.filter((e) => e.outcome === "rejected_conflict").length,
    invalid: events.filter((e) => e.outcome === "rejected_invalid").length,
  };

  return { events, summary };
}
