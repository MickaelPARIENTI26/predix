import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getCompetition } from "@/lib/competitions/queries";
import { getGameData } from "@/lib/competitions/game-queries";
import { ResultsClient, type ResultMatch } from "./results-client";
import { ScoringRulesForm } from "./scoring-rules-form";
import { AdjustmentsPanel } from "./adjustments-panel";
import { BonusAdminPanel, type BonusQ } from "./bonus-admin-panel";
import { getScoringRules, getAdjustments } from "@/lib/scoring/queries";
import { getBonusQuestions, getTournamentPlayers } from "@/lib/bonus/queries";

const STAGE_LABELS: Record<string, string> = {
  group: "Phase de groupes",
  round_of_16: "8es",
  quarter: "Quarts",
  semi: "Demi-finales",
  third_place: "Petite finale",
  final: "Finale",
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const competition = await getCompetition(id, user.id);
  if (!competition || competition.myRole !== "organizer") notFound();

  const [game, rules, adjustments, bonusQuestions, players] = await Promise.all([
    getGameData(id),
    getScoringRules(id),
    getAdjustments(id),
    getBonusQuestions(id),
    getTournamentPlayers(id),
  ]);

  const members = competition.members.map((m) => ({
    userId: m.user_id,
    name: m.display_name,
  }));

  const teamOptions = game.teams.map((t) => ({ id: t.id, name: t.name }));
  const playerOptions = players.map((p) => ({
    id: p.id,
    name: p.name,
    teamId: p.teamId,
  }));
  const bonusQs: BonusQ[] = bonusQuestions.map((q) => ({
    kind: q.kind,
    lockAt: q.lockAt,
    answerId: q.answer?.player_id ?? q.answer?.team_id ?? null,
  }));

  const teamName = (tid: string | null) =>
    tid ? (game.teams.find((t) => t.id === tid)?.name ?? "?") : "?";

  const matches: ResultMatch[] = game.matches
    .filter((m) => m.home_team_id && m.away_team_id)
    .map((m) => ({
      id: m.id,
      homeTeam: teamName(m.home_team_id),
      awayTeam: teamName(m.away_team_id),
      kickoffAt: m.kickoff_at,
      stageLabel: STAGE_LABELS[m.stage] ?? m.stage,
      homeScore: m.home_score,
      awayScore: m.away_score,
      finished: m.status === "finished",
    }));

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <Link
          href={`/competitions/${id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {competition.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Résultats</h1>
        <p className="text-muted-foreground text-sm">
          Saisis les scores réels. Le classement se recalcule automatiquement.
        </p>
      </div>

      <ScoringRulesForm competitionId={id} rules={rules} />

      <AdjustmentsPanel
        competitionId={id}
        members={members}
        adjustments={adjustments}
      />

      <BonusAdminPanel
        competitionId={id}
        teams={teamOptions}
        players={playerOptions}
        questions={bonusQs}
      />

      {matches.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucun match.</p>
      ) : (
        <ResultsClient competitionId={id} matches={matches} />
      )}
    </div>
  );
}
