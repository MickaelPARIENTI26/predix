import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/user";
import { getCompetition } from "@/lib/competitions/queries";
import { getLeaderboard, getScoringRules } from "@/lib/scoring/queries";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const competition = await getCompetition(id, user.id);
  if (!competition) notFound();

  const [rows, rules] = await Promise.all([
    getLeaderboard(id),
    getScoringRules(id),
  ]);

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <Link
          href={`/competitions/${id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {competition.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Classement</h1>
        <p className="text-muted-foreground text-sm">
          Score exact : {rules.exact_score} pts · Bon résultat :{" "}
          {rules.correct_outcome} pt.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Général</CardTitle>
          <CardDescription>
            Mis à jour à chaque résultat saisi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col">
            {rows.map((r, i) => (
              <li
                key={r.userId}
                className={`flex items-center justify-between border-b py-2 last:border-0 ${
                  r.userId === user.id ? "font-semibold" : ""
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground w-6 text-right tabular-nums">
                    {i + 1}
                  </span>
                  <span>{r.displayName}</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-muted-foreground text-xs">
                    {r.exact} exact · {r.outcome} bon
                  </span>
                  <span className="tabular-nums font-medium">{r.points} pts</span>
                </span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
