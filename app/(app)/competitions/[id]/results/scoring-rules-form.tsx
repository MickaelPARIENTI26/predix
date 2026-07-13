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
import { setScoringRules } from "@/lib/scoring/actions";
import {
  SCORING_PHASES,
  type ScoringRules,
  type ScoringPhaseKey,
} from "@/lib/schemas/scoring";

type Dimension = "exact" | "diff" | "outcome";
const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "exact", label: "Score exact" },
  { key: "diff", label: "Bon écart" },
  { key: "outcome", label: "Bon résultat" },
];

// state as strings for the inputs
type Draft = Record<ScoringPhaseKey, Record<Dimension, string>>;

function toDraft(rules: ScoringRules): Draft {
  return {
    groups: str(rules.groups),
    knockout: str(rules.knockout),
    final: str(rules.final),
  };
  function str(p: { exact: number; diff: number; outcome: number }) {
    return {
      exact: String(p.exact),
      diff: String(p.diff),
      outcome: String(p.outcome),
    };
  }
}

export function ScoringRulesForm({
  competitionId,
  rules,
}: {
  competitionId: string;
  rules: ScoringRules;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rules));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function update(phase: ScoringPhaseKey, dim: Dimension, value: string) {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      [phase]: { ...d[phase], [dim]: value.replace(/[^0-9]/g, "") },
    }));
  }

  function onSave() {
    setError("");
    setSaved(false);
    const config: ScoringRules = {
      groups: nums(draft.groups),
      knockout: nums(draft.knockout),
      final: nums(draft.final),
    };
    startTransition(async () => {
      const res = await setScoringRules(competitionId, config);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Barème par phase</CardTitle>
        <CardDescription>
          Modifiable à tout moment ; le classement se recalcule.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {SCORING_PHASES.map((phase) => (
          <div key={phase.key} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{phase.label}</p>
            <div className="flex flex-wrap gap-3">
              {DIMENSIONS.map((dim) => (
                <div key={dim.key} className="flex flex-col gap-1">
                  <Label
                    htmlFor={`${phase.key}-${dim.key}`}
                    className="text-muted-foreground text-xs"
                  >
                    {dim.label}
                  </Label>
                  <Input
                    id={`${phase.key}-${dim.key}`}
                    inputMode="numeric"
                    className="w-20"
                    value={draft[phase.key][dim.key]}
                    onChange={(e) => update(phase.key, dim.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button type="button" size="sm" disabled={pending} onClick={onSave}>
            {pending ? "…" : "Enregistrer le barème"}
          </Button>
          {saved && <span className="text-xs text-green-600">Enregistré.</span>}
          {error && <span className="text-destructive text-xs">{error}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function nums(d: Record<Dimension, string>) {
  return {
    exact: Number(d.exact || 0),
    diff: Number(d.diff || 0),
    outcome: Number(d.outcome || 0),
  };
}
