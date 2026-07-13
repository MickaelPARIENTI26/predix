import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth/user";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Defense in depth: middleware already redirects, but a protected Server
  // Component must not assume it.
  await requireUser();
  const profile = await getProfile();

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <Link href="/competitions" className="font-bold tracking-tight">
          Predix
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/competitions"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Compétitions
          </Link>
          <Link
            href="/profile"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            {profile?.display_name ?? "Profil"}
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Déconnexion
            </Button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">{children}</main>
    </div>
  );
}
