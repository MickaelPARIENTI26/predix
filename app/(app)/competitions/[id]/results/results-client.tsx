"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseScoreInput } from "@/lib/schemas/prediction";
import { setMatchResult, clearMatchResult } from "@/lib/scoring/actions";

export type ResultMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  stageLabel: string;
  homeScore: number | null;
  awayScore: number | null;
  finished: boolean;
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ResultsClient({
  competitionId,
  matches,
}: {
  competitionId: string;
  matches: ResultMatch[];
}) {
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((m) => (
        <li key={m.id}>
          <ResultRow competitionId={competitionId} match={m} />
        </li>
      ))}
    </ul>
  );
}

function ResultRow({
  competitionId,
  match,
}: {
  competitionId: string;
  match: ResultMatch;
}) {
  const [home, setHome] = useState(
    match.homeScore !== null ? String(match.homeScore) : ""
  );
  const [away, setAway] = useState(
    match.awayScore !== null ? String(match.awayScore) : ""
  );
  const [finished, setFinished] = useState(match.finished);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const valid = parseScoreInput(home) !== null && parseScoreInput(away) !== null;

  function onValidate() {
    const h = parseScoreInput(home);
    const a = parseScoreInput(away);
    if (h === null || a === null) {
      setError("Score entre 0 et 99.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await setMatchResult(competitionId, match.id, h, a);
      if (res.ok) setFinished(true);
      else setError(res.error);
    });
  }

  function onClear() {
    setError("");
    startTransition(async () => {
      const res = await clearMatchResult(competitionId, match.id);
      if (res.ok) {
        setFinished(false);
        setHome("");
        setAway("");
      } else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>{match.stageLabel}</span>
        <span>{fmtTime(match.kickoffAt)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-right text-sm font-medium">
          {match.homeTeam}
        </span>
        <Input
          aria-label={`Résultat ${match.homeTeam}`}
          inputMode="numeric"
          className="w-12 text-center"
          maxLength={2}
          value={home}
          disabled={pending}
          onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          aria-label={`Résultat ${match.awayTeam}`}
          inputMode="numeric"
          className="w-12 text-center"
          maxLength={2}
          value={away}
          disabled={pending}
          onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <span className="flex-1 truncate text-sm font-medium">
          {match.awayTeam}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : finished ? (
            <Badge variant="secondary">Résultat validé</Badge>
          ) : (
            <span className="text-muted-foreground">Pas encore joué</span>
          )}
        </span>
        <span className="flex gap-2">
          {finished && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={onClear}
            >
              Effacer
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={pending || !valid}
            onClick={onValidate}
          >
            {finished ? "Corriger" : "Valider"}
          </Button>
        </span>
      </div>
    </div>
  );
}
