import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth/user";
import { getMyCompetitions } from "@/lib/competitions/queries";
import {
  CreateCompetitionForm,
  JoinCompetitionForm,
} from "./create-join-forms";

export default async function CompetitionsPage() {
  await requireUser();
  const competitions = await getMyCompetitions();

  return (
    <div className="flex flex-col gap-6 py-4">
      <h1 className="text-2xl font-bold tracking-tight">Mes compétitions</h1>

      {competitions.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Tu n&apos;as pas encore de compétition. Crées-en une ou rejoins celle
          d&apos;un ami avec son code.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {competitions.map((c) => (
            <li key={c.id}>
              <Link href={`/competitions/${c.id}`} className="block">
                <Card className="hover:border-foreground/30 transition-colors">
                  <CardContent className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant={c.role === "organizer" ? "default" : "secondary"}>
                      {c.role === "organizer" ? "Organisateur" : "Joueur"}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Créer une compétition</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateCompetitionForm />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rejoindre avec un code</CardTitle>
          </CardHeader>
          <CardContent>
            <JoinCompetitionForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
