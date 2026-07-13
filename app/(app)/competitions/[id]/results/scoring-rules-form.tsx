"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { setScoringRules } from "@/lib/scoring/actions";

export function ScoringRulesForm({
  competitionId,
  exactScore,
  correctOutcome,
}: {
  competitionId: string;
  exactScore: number;
  correctOutcome: number;
}) {
  const [exact, setExact] = useState(String(exactScore));
  const [outcome, setOutcome] = useState(String(correctOutcome));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSave() {
    setError("");
    setSaved(false);
    const e = Number(exact);
    const o = Number(outcome);
    if (!Number.isInteger(e) || !Number.isInteger(o) || e < 0 || o < 0) {
      setError("Valeurs invalides.");
      return;
    }
    startTransition(async () => {
      const res = await setScoringRules(competitionId, e, o);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Barème</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="exact" className="text-xs">
            Score exact
          </Label>
          <Input
            id="exact"
            inputMode="numeric"
            className="w-20"
            value={exact}
            onChange={(ev) => {
              setExact(ev.target.value.replace(/[^0-9]/g, ""));
              setSaved(false);
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="outcome" className="text-xs">
            Bon résultat
          </Label>
          <Input
            id="outcome"
            inputMode="numeric"
            className="w-20"
            value={outcome}
            onChange={(ev) => {
              setOutcome(ev.target.value.replace(/[^0-9]/g, ""));
              setSaved(false);
            }}
          />
        </div>
        <Button type="button" size="sm" disabled={pending} onClick={onSave}>
          {pending ? "…" : "Enregistrer le barème"}
        </Button>
        {saved && <span className="text-xs text-green-600">Enregistré.</span>}
        {error && <span className="text-destructive text-xs">{error}</span>}
      </CardContent>
    </Card>
  );
}
