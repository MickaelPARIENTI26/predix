import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth/user";

export default async function Home() {
  const user = await getUser();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="secondary">F1 — Auth &amp; profils</Badge>
        <h1 className="text-5xl font-bold tracking-tight">Predix</h1>
        <p className="text-muted-foreground max-w-md text-balance">
          Pronostics entre amis. Chaque prono est horodaté, versionné et
          verrouillé au coup d&apos;envoi.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3">
        {user ? (
          <Link href="/competitions" className={buttonVariants()}>
            Mes compétitions
          </Link>
        ) : (
          <div className="flex gap-3">
            <Link href="/signup" className={buttonVariants()}>
              Créer un compte
            </Link>
            <Link href="/login" className={buttonVariants({ variant: "outline" })}>
              Se connecter
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
