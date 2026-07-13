"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { teamSchema, matchSchema } from "@/lib/schemas/competition";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidate(competitionId: string) {
  revalidatePath(`/competitions/${competitionId}/manage`);
  revalidatePath(`/competitions/${competitionId}`);
}

// --- Manual CRUD (organizer-only, enforced by RLS) -------------------------

export async function addTeam(
  competitionId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nom d'équipe invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({
    competition_id: competitionId,
    name: parsed.data.name,
    code: parsed.data.code ? parsed.data.code : null,
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "Cette équipe existe déjà." : "Ajout impossible.",
    };
  }
  revalidate(competitionId);
  return { ok: true };
}

export async function deleteTeam(
  competitionId: string,
  teamId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return { ok: false, error: "Suppression impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function addMatch(
  competitionId: string,
  input: unknown
): Promise<ActionResult> {
  const parsed = matchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Match invalide." };

  const supabase = await createClient();
  const { error } = await supabase.from("matches").insert({
    competition_id: competitionId,
    stage: parsed.data.stage,
    group_id: parsed.data.groupId ?? null,
    home_team_id: parsed.data.homeTeamId ?? null,
    away_team_id: parsed.data.awayTeamId ?? null,
    kickoff_at: parsed.data.kickoffAt,
  });
  if (error) return { ok: false, error: "Ajout du match impossible." };
  revalidate(competitionId);
  return { ok: true };
}

export async function deleteMatch(
  competitionId: string,
  matchId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("matches").delete().eq("id", matchId);
  if (error) return { ok: false, error: "Suppression impossible." };
  revalidate(competitionId);
  return { ok: true };
}

/** Remove all teams/groups/stages/matches (matches/group_teams cascade). */
export async function clearGameData(
  competitionId: string
): Promise<ActionResult> {
  const supabase = await createClient();
  // matches reference teams/groups with ON DELETE SET NULL, so delete matches
  // first, then groups & teams (group_teams cascades from either).
  await supabase.from("matches").delete().eq("competition_id", competitionId);
  await supabase.from("groups").delete().eq("competition_id", competitionId);
  await supabase.from("teams").delete().eq("competition_id", competitionId);
  await supabase
    .from("knockout_stages")
    .delete()
    .eq("competition_id", competitionId);
  revalidate(competitionId);
  return { ok: true };
}

// --- One-click test tournament --------------------------------------------

const TEST_TEAMS = [
  ["France", "FRA"], ["Brésil", "BRA"], ["Argentine", "ARG"], ["Espagne", "ESP"],
  ["Angleterre", "ENG"], ["Allemagne", "GER"], ["Portugal", "POR"], ["Pays-Bas", "NED"],
  ["Belgique", "BEL"], ["Croatie", "CRO"], ["Italie", "ITA"], ["Uruguay", "URU"],
  ["Maroc", "MAR"], ["Japon", "JPN"], ["Sénégal", "SEN"], ["USA", "USA"],
] as const;
const GROUP_NAMES = ["Groupe A", "Groupe B", "Groupe C", "Groupe D"];
// round-robin pairings for a group of 4 (indices into the group's 4 teams)
const RR_PAIRS: [number, number][] = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

/** Populate a small ready-to-play tournament: 4 groups × 4 teams, group
 *  matches, and a quarter→final knockout with placeholder slots. Refuses if the
 *  competition already has teams (clear first). */
export async function generateTestTournament(
  competitionId: string
): Promise<ActionResult> {
  const supabase = await createClient();

  const { count } = await supabase
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("competition_id", competitionId);
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: "La compétition contient déjà des données. Vide-la d'abord.",
    };
  }

  // Teams
  const { data: teams, error: teamErr } = await supabase
    .from("teams")
    .insert(TEST_TEAMS.map(([name, code]) => ({ competition_id: competitionId, name, code })))
    .select("id, name");
  if (teamErr || !teams) return { ok: false, error: "Création des équipes impossible." };
  const teamId = (name: string) => teams.find((t) => t.name === name)!.id;

  // Groups
  const { data: groups, error: groupErr } = await supabase
    .from("groups")
    .insert(GROUP_NAMES.map((name) => ({ competition_id: competitionId, name })))
    .select("id, name");
  if (groupErr || !groups) return { ok: false, error: "Création des groupes impossible." };
  const groupId = (name: string) => groups.find((g) => g.name === name)!.id;

  // 4 teams per group, in TEST_TEAMS order
  const groupTeamNames: Record<string, string[]> = {};
  GROUP_NAMES.forEach((gname, gi) => {
    groupTeamNames[gname] = TEST_TEAMS.slice(gi * 4, gi * 4 + 4).map(([n]) => n);
  });

  const groupTeamsRows = GROUP_NAMES.flatMap((gname) =>
    groupTeamNames[gname].map((tn) => ({ group_id: groupId(gname), team_id: teamId(tn) }))
  );
  const { error: gtErr } = await supabase.from("group_teams").insert(groupTeamsRows);
  if (gtErr) return { ok: false, error: "Affectation des équipes impossible." };

  // Kickoffs start tomorrow, 18:00 UTC, each match +90 min.
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 1);
  base.setUTCHours(18, 0, 0, 0);
  let slot = 0;
  const nextKickoff = () => {
    const d = new Date(base.getTime() + slot * 90 * 60 * 1000);
    slot += 1;
    return d.toISOString();
  };

  // Group matches (round robin within each group)
  const groupMatches = GROUP_NAMES.flatMap((gname) => {
    const names = groupTeamNames[gname];
    return RR_PAIRS.map(([a, b]) => ({
      competition_id: competitionId,
      stage: "group" as const,
      group_id: groupId(gname),
      home_team_id: teamId(names[a]),
      away_team_id: teamId(names[b]),
      kickoff_at: nextKickoff(),
    }));
  });

  // Knockout stages + placeholder matches (teams resolved after the group stage)
  const { error: ksErr } = await supabase.from("knockout_stages").insert(
    ["quarter", "semi", "final"].map((kind) => ({ competition_id: competitionId, kind }))
  );
  if (ksErr) return { ok: false, error: "Création des tours finaux impossible." };

  // knockout kickoffs a few days after the groups
  const koBase = new Date(base.getTime() + 5 * 24 * 60 * 60 * 1000);
  let koSlot = 0;
  const koKickoff = () => {
    const d = new Date(koBase.getTime() + koSlot * 24 * 60 * 60 * 1000);
    koSlot += 1;
    return d.toISOString();
  };
  const knockoutMatches = [
    { stage: "quarter", label: "1er A – 2e B" },
    { stage: "quarter", label: "1er C – 2e D" },
    { stage: "quarter", label: "1er B – 2e A" },
    { stage: "quarter", label: "1er D – 2e C" },
    { stage: "semi", label: "Vainqueur QF1 – Vainqueur QF2" },
    { stage: "semi", label: "Vainqueur QF3 – Vainqueur QF4" },
    { stage: "third_place", label: "Petite finale" },
    { stage: "final", label: "Finale" },
  ].map((m) => ({
    competition_id: competitionId,
    stage: m.stage,
    label: m.label,
    kickoff_at: koKickoff(),
  }));

  const { error: matchErr } = await supabase
    .from("matches")
    .insert([...groupMatches, ...knockoutMatches]);
  if (matchErr) return { ok: false, error: "Création des matchs impossible." };

  revalidate(competitionId);
  return { ok: true };
}
