import { createClient } from "@/lib/supabase/server";

export type Team = { id: string; name: string; code: string | null };
export type GroupWithTeams = {
  id: string;
  name: string;
  teamIds: string[];
};
export type Match = {
  id: string;
  stage: string;
  group_id: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  label: string | null;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

export type GameData = {
  teams: Team[];
  groups: GroupWithTeams[];
  matches: Match[];
};

/** All game data for a competition (member-readable via RLS). */
export async function getGameData(competitionId: string): Promise<GameData> {
  const supabase = await createClient();

  const [teamsRes, groupsRes, groupTeamsRes, matchesRes] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, code")
      .eq("competition_id", competitionId)
      .order("name"),
    supabase
      .from("groups")
      .select("id, name")
      .eq("competition_id", competitionId)
      .order("name"),
    supabase.from("group_teams").select("group_id, team_id"),
    supabase
      .from("matches")
      .select(
        "id, stage, group_id, home_team_id, away_team_id, label, kickoff_at, home_score, away_score, status"
      )
      .eq("competition_id", competitionId)
      .order("kickoff_at"),
  ]);

  const teams = teamsRes.data ?? [];
  const groupTeams = groupTeamsRes.data ?? [];
  const groups = (groupsRes.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    teamIds: groupTeams
      .filter((gt) => gt.group_id === g.id)
      .map((gt) => gt.team_id),
  }));

  return {
    teams,
    groups,
    matches: matchesRes.data ?? [],
  };
}
