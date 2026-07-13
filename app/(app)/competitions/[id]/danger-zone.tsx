"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { leaveCompetition, deleteCompetition } from "@/lib/competitions/actions";

export function LeaveButton({ competitionId }: { competitionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => leaveCompetition(competitionId))}
    >
      Quitter la compétition
    </Button>
  );
}

export function DeleteButton({ competitionId }: { competitionId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          confirm(
            "Supprimer définitivement cette compétition et toutes ses données ?"
          )
        ) {
          startTransition(() => deleteCompetition(competitionId));
        }
      }}
    >
      Supprimer la compétition
    </Button>
  );
}
