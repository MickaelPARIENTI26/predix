import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import { getCompetition } from "@/lib/competitions/queries";
import { getGameData } from "@/lib/competitions/game-queries";
import { ManageClient } from "./manage-client";

export default async function ManagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const competition = await getCompetition(id, user.id);

  // Only the organizer manages game data.
  if (!competition || competition.myRole !== "organizer") notFound();

  const game = await getGameData(id);

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <Link
          href={`/competitions/${id}`}
          className="text-muted-foreground text-sm hover:underline"
        >
          ← {competition.name}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Gérer le tournoi</h1>
      </div>
      <ManageClient competitionId={id} game={game} />
    </div>
  );
}
