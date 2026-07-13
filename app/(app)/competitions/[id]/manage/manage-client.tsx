"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GameData } from "@/lib/competitions/game-queries";
import {
  addTeam,
  deleteTeam,
  deleteMatch,
  clearGameData,
  generateTestTournament,
} from "@/lib/competitions/game-actions";

const STAGE_LABELS: Record<string, string> = {
  group: "Phase de groupes",
  quarter: "Quarts",
  semi: "Demi-finales",
  third_place: "Petite finale",
  final: "Finale",
  round_of_16: "8es de finale",
};

function fmtKickoff(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ManageClient({
  competitionId,
  game,
}: {
  competitionId: string;
  game: GameData;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const teamName = (id: string | null) =>
    id ? (game.teams.find((t) => t.id === id)?.name ?? "?") : "?";

  const isEmpty = game.teams.length === 0;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
    });
  }

  const matchesByStage = game.matches.reduce<Record<string, typeof game.matches>>(
    (acc, m) => {
      (acc[m.stage] ??= []).push(m);
      return acc;
    },
    {}
  );

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-destructive text-sm">{error}</p>}

      {/* Quick setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuration rapide</CardTitle>
          <CardDescription>
            Génère un petit tournoi de test (4 groupes de 4 équipes + phase
            finale) pour démarrer immédiatement.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button
            type="button"
            disabled={pending || !isEmpty}
            onClick={() => run(() => generateTestTournament(competitionId))}
          >
            {pending ? "…" : "Générer un tournoi de test"}
          </Button>
          {!isEmpty && (
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (confirm("Vider toutes les équipes, groupes et matchs ?")) {
                  run(() => clearGameData(competitionId));
                }
              }}
            >
              Tout vider
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Teams */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Équipes ({game.teams.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <AddTeamForm competitionId={competitionId} />
          <ul className="flex flex-wrap gap-2">
            {game.teams.map((t) => (
              <li key={t.id}>
                <Badge variant="secondary" className="gap-1">
                  {t.name}
                  <button
                    type="button"
                    aria-label={`Supprimer ${t.name}`}
                    className="ml-1 opacity-60 hover:opacity-100"
                    disabled={pending}
                    onClick={() => run(() => deleteTeam(competitionId, t.id))}
                  >
                    ×
                  </button>
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Groups */}
      {game.groups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Groupes</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {game.groups.map((g) => (
              <div key={g.id} className="rounded border p-3">
                <p className="font-medium">{g.name}</p>
                <ul className="text-muted-foreground text-sm">
                  {g.teamIds.map((tid) => (
                    <li key={tid}>{teamName(tid)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Matches */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Matchs ({game.matches.length})</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {game.matches.length === 0 && (
            <p className="text-muted-foreground text-sm">Aucun match.</p>
          )}
          {Object.entries(matchesByStage).map(([stage, matches]) => (
            <div key={stage} className="flex flex-col gap-1.5">
              <p className="text-sm font-medium">
                {STAGE_LABELS[stage] ?? stage}
              </p>
              <ul className="flex flex-col gap-1">
                {matches.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span>
                      {m.stage === "group"
                        ? `${teamName(m.home_team_id)} – ${teamName(m.away_team_id)}`
                        : (m.label ?? "—")}
                      <span className="text-muted-foreground ml-2">
                        {fmtKickoff(m.kickoff_at)}
                      </span>
                    </span>
                    <button
                      type="button"
                      aria-label="Supprimer le match"
                      className="text-muted-foreground hover:text-destructive"
                      disabled={pending}
                      onClick={() => run(() => deleteMatch(competitionId, m.id))}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AddTeamForm({ competitionId }: { competitionId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    const raw = Object.fromEntries(new FormData(form));
    startTransition(async () => {
      const res = await addTeam(competitionId, raw);
      if (res.ok) form.reset();
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="team-name" className="text-xs">
          Ajouter une équipe
        </Label>
        <Input
          id="team-name"
          name="name"
          placeholder="Nom"
          maxLength={60}
          className="w-40"
          required
        />
      </div>
      <Input name="code" placeholder="Code" maxLength={8} className="w-20" />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Ajouter
      </Button>
      {error && <p className="text-destructive w-full text-sm">{error}</p>}
    </form>
  );
}
