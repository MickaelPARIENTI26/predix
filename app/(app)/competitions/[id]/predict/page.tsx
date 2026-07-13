import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getCompetition } from "@/lib/competitions/queries";
import { getGameData } from "@/lib/competitions/game-queries";
import {
  getMyScorePredictions,
  getMyGroupRankings,
} from "@/lib/predictions/queries";
import {
  PredictClient,
  type PredictMatch,
  type InitialPrediction,
} from "./predict-client";
import {
  GroupRankingClient,
  type PredictGroup,
  type InitialRanking,
} from "./group-ranking-client";

const STAGE_LABELS: Record<string, string> = {
  group: "Phase de groupes",
  round_of_16: "8es",
  quarter: "Quarts",
  semi: "Demi-finales",
  third_place: "Petite finale",
  final: "Finale",
};

export default async function PredictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const competition = await getCompetition(id, user.id);
  if (!competition) notFound();

  const [game, myPredictions, myRankings] = await Promise.all([
    getGameData(id),
    getMyScorePredictions(id),
    getMyGroupRankings(id),
  ]);

  const teamName = (tid: string | null) =>
    tid ? (game.teams.find((t) => t.id === tid)?.name ?? "?") : "?";

  // Group-ranking targets: each group with its teams + lock = its first kickoff.
  const groups: PredictGroup[] = game.groups
    .filter((g) => g.teamIds.length >= 2)
    .map((g) => {
      const kickoffs = game.matches
        .filter((m) => m.group_id === g.id)
        .map((m) => m.kickoff_at)
        .sort();
      return {
        id: g.id,
        name: g.name,
        teams: g.teamIds.map((tid) => ({ id: tid, name: teamName(tid) })),
        lockAt: kickoffs[0] ?? null,
      };
    });

  const initialRankings: Record<string, InitialRanking> = {};
  for (const [groupId, r] of myRankings) {
    initialRankings[groupId] = { ranking: r.ranking, version: r.version };
  }

  // Score predictions apply to matches whose two teams are known.
  const matches: PredictMatch[] = game.matches
    .filter((m) => m.home_team_id && m.away_team_id)
    .map((m) => ({
      id: m.id,
      homeTeam: teamName(m.home_team_id),
      awayTeam: teamName(m.away_team_id),
      kickoffAt: m.kickoff_at,
      stageLabel: STAGE_LABELS[m.stage] ?? m.stage,
    }));

  const initial: Record<string, InitialPrediction> = {};
  for (const [matchId, p] of myPredictions) {
    initial[matchId] = { home: p.home, away: p.away, version: p.version };
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <Link
          href={`/competitions/${id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {competition.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Mes pronostics</h1>
        <p className="text-muted-foreground text-sm">
          Chaque pronostic se verrouille à son coup d&apos;envoi.
        </p>
      </div>

      {groups.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Classements des groupes</h2>
          <p className="text-muted-foreground text-sm">
            Ordonne les équipes de chaque groupe. Verrouillé au 1er match du
            groupe.
          </p>
          <GroupRankingClient groups={groups} initial={initialRankings} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Scores des matchs</h2>
        {matches.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucun match à pronostiquer pour l&apos;instant.
          </p>
        ) : (
          <PredictClient matches={matches} initial={initial} />
        )}
      </section>
    </div>
  );
}
