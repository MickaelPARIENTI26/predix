import Link from "next/link";
import { requireUser, getProfile } from "@/lib/auth/user";
import { AppNav } from "./app-nav";

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
      <header className="relative flex items-center justify-between border-b px-4 py-3">
        <Link href="/competitions" className="font-bold tracking-tight">
          Predix
        </Link>
        <AppNav displayName={profile?.display_name ?? "Profil"} />
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 p-4">{children}</main>
    </div>
  );
}
