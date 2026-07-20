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
import {
  getAdminEvents,
  getPredictionAudit,
  adminKindLabel,
} from "@/lib/audit/queries";
import { AuditClient } from "./audit-client";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const competition = await getCompetition(id, user.id);
  if (!competition || competition.myRole !== "organizer") notFound();

  const [audit, adminEvents] = await Promise.all([
    getPredictionAudit(id),
    getAdminEvents(id),
  ]);

  const stats = [
    { label: "Pronos acceptés", value: audit.summary.accepted },
    { label: "Tentatives tardives", value: audit.summary.late },
    { label: "Conflits", value: audit.summary.conflicts },
    { label: "Refusés (invalides)", value: audit.summary.invalid },
  ];

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <Link
          href={`/competitions/${id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {competition.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Audit</h1>
        <p className="text-muted-foreground text-sm">
          Chaque pronostic est horodaté à l&apos;heure serveur. Pour trancher un
          litige.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex flex-col gap-0.5">
              <span className="text-2xl font-bold tabular-nums">{s.value}</span>
              <span className="text-muted-foreground text-xs">{s.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activité des pronostics</CardTitle>
          <CardDescription>
            Toutes les tentatives arrivées au serveur (500 plus récentes).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditClient events={audit.events} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Journal des actions admin</CardTitle>
        </CardHeader>
        <CardContent>
          {adminEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune action.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {adminEvents.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-2 border-b py-1.5 last:border-0"
                >
                  <span>
                    <span className="font-medium">{adminKindLabel(e.kind)}</span>
                    <span className="text-muted-foreground"> · {e.actorName}</span>
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {fmt(e.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
