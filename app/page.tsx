import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function Home() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="secondary">F0 — Fondations</Badge>
        <h1 className="text-5xl font-bold tracking-tight">Predix</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Pronostics entre amis. Chaque prono est horodaté, versionné et
          verrouillé au coup d&apos;envoi.
        </p>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>En construction</CardTitle>
          <CardDescription>
            Prochaine étape : authentification et profils (sprint F1).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          Cible : Euro 2028 — avec des compétitions de test avant.
        </CardContent>
      </Card>
    </main>
  );
}
