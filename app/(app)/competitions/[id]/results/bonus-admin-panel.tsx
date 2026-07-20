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
import {
  BONUS_KINDS,
  BONUS_LABELS,
  bonusPicksTeam,
  type BonusKind,
} from "@/lib/schemas/prediction";
import {
  setBonusQuestion,
  setBonusAnswer,
  addPlayer,
  removePlayer,
} from "@/lib/bonus/actions";

export type Opt = { id: string; name: string };
export type BonusQ = {
  kind: BonusKind;
  lockAt: string | null;
  answerId: string | null;
};

export function BonusAdminPanel({
  competitionId,
  teams,
  players,
  questions,
}: {
  competitionId: string;
  teams: Opt[];
  players: (Opt & { teamId: string | null })[];
  questions: BonusQ[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Erreur.");
    });
  }

  const byKind = new Map(questions.map((q) => [q.kind, q]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bonus de tournoi</CardTitle>
        <CardDescription>
          Ajoute les joueurs, fixe une date limite par bonus, puis saisis les
          réponses en fin de tournoi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Players */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Joueurs</p>
          <AddPlayerForm competitionId={competitionId} teams={teams} onError={setError} />
          {players.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {players.map((p) => (
                <li key={p.id}>
                  <Badge variant="secondary" className="gap-1">
                    {p.name}
                    <button
                      type="button"
                      aria-label={`Supprimer ${p.name}`}
                      className="ml-1 opacity-60 hover:opacity-100"
                      disabled={pending}
                      onClick={() => run(() => removePlayer(competitionId, p.id))}
                    >
                      ×
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Bonus questions */}
        <div className="flex flex-col gap-3">
          {BONUS_KINDS.map((kind) => {
            const q = byKind.get(kind);
            const options = bonusPicksTeam(kind) ? teams : players;
            return (
              <BonusQuestionRow
                key={kind}
                competitionId={competitionId}
                kind={kind}
                question={q ?? null}
                options={options}
                pending={pending}
                run={run}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function AddPlayerForm({
  competitionId,
  teams,
  onError,
}: {
  competitionId: string;
  teams: Opt[];
  onError: (s: string) => void;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [pending, startTransition] = useTransition();

  function onAdd() {
    if (name.trim().length === 0) {
      onError("Nom du joueur requis.");
      return;
    }
    startTransition(async () => {
      const res = await addPlayer(competitionId, name, teamId || null);
      if (res.ok) setName("");
      else onError(res.error);
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label className="text-xs" htmlFor="player-name">
          Nom
        </Label>
        <Input
          id="player-name"
          className="w-40"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <select
        aria-label="Équipe du joueur"
        className="border-input bg-background h-9 rounded-md border px-2 text-sm"
        value={teamId}
        onChange={(e) => setTeamId(e.target.value)}
      >
        <option value="">Équipe…</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onAdd}>
        Ajouter
      </Button>
    </div>
  );
}

function BonusQuestionRow({
  competitionId,
  kind,
  question,
  options,
  pending,
  run,
}: {
  competitionId: string;
  kind: BonusKind;
  question: BonusQ | null;
  options: Opt[];
  pending: boolean;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [lock, setLock] = useState("");
  const [answer, setAnswer] = useState(question?.answerId ?? "");

  return (
    <div className="flex flex-col gap-2 rounded border p-3">
      <p className="text-sm font-medium">{BONUS_LABELS[kind]}</p>
      {question ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Limite : {question.lockAt ? new Date(question.lockAt).toLocaleString("fr-FR") : "—"}
          </span>
          <select
            aria-label={`Réponse ${BONUS_LABELS[kind]}`}
            className="border-input bg-background h-9 rounded-md border px-2 text-sm"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          >
            <option value="">Réponse…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={pending || !answer}
            onClick={() => run(() => setBonusAnswer(competitionId, kind, answer))}
          >
            Valider la réponse
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor={`lock-${kind}`}>
              Date limite des pronos
            </Label>
            <Input
              id={`lock-${kind}`}
              type="datetime-local"
              className="w-52"
              value={lock}
              onChange={(e) => setLock(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || !lock}
            onClick={() =>
              run(() =>
                setBonusQuestion(
                  competitionId,
                  kind,
                  new Date(lock).toISOString()
                )
              )
            }
          >
            Activer ce bonus
          </Button>
        </div>
      )}
    </div>
  );
}
