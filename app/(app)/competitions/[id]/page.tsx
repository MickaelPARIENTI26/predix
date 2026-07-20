import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/user";
import { getCompetition } from "@/lib/competitions/queries";
import { InviteCode } from "./invite-code";
import { LeaveButton, DeleteButton } from "./danger-zone";

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const competition = await getCompetition(id, user.id);

  if (!competition) notFound();

  const isOrganizer = competition.myRole === "organizer";

  return (
    <div className="flex flex-col gap-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/competitions"
            className="text-muted-foreground text-sm hover:underline"
          >
            ← Mes compétitions
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            {competition.name}
          </h1>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link
            href={`/competitions/${id}/predict`}
            className={buttonVariants({ size: "sm" })}
          >
            Pronostiquer
          </Link>
          <Link
            href={`/competitions/${id}/leaderboard`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Classement
          </Link>
          {isOrganizer && (
            <>
              <Link
                href={`/competitions/${id}/results`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Résultats
              </Link>
              <Link
                href={`/competitions/${id}/audit`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Audit
              </Link>
              <Link
                href={`/competitions/${id}/manage`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Gérer
              </Link>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Code d&apos;invitation</CardTitle>
          <CardDescription>
            Partage ce code avec tes amis pour qu&apos;ils rejoignent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InviteCode code={competition.invite_code} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Participants ({competition.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-2">
            {competition.members.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span>{m.display_name}</span>
                {m.role === "organizer" && (
                  <Badge variant="secondary">Organisateur</Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        {isOrganizer ? (
          <DeleteButton competitionId={id} />
        ) : (
          <LeaveButton competitionId={id} />
        )}
      </div>
    </div>
  );
}
