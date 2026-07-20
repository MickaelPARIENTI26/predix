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
import { addAdjustment, removeAdjustment } from "@/lib/scoring/actions";
import type { Adjustment } from "@/lib/scoring/queries";

export type MemberOption = { userId: string; name: string };

export function AdjustmentsPanel({
  competitionId,
  members,
  adjustments,
}: {
  competitionId: string;
  members: MemberOption[];
  adjustments: Adjustment[];
}) {
  const [member, setMember] = useState(members[0]?.userId ?? "");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onAdd() {
    setError("");
    const p = Number(points);
    if (!points || !Number.isInteger(p)) {
      setError("Entre un nombre de points (négatif = malus).");
      return;
    }
    if (reason.trim().length === 0) {
      setError("Motif obligatoire.");
      return;
    }
    startTransition(async () => {
      const res = await addAdjustment(competitionId, member, p, reason);
      if (res.ok) {
        setPoints("");
        setReason("");
      } else setError(res.error);
    });
  }

  function onRemove(id: number) {
    startTransition(async () => {
      await removeAdjustment(competitionId, id);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bonus / Malus</CardTitle>
        <CardDescription>
          Ajoute ou retire des points à un participant (motif obligatoire).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="adj-member">
              Participant
            </Label>
            <select
              id="adj-member"
              className="border-input bg-background h-9 rounded-md border px-2 text-sm"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs" htmlFor="adj-points">
              Points (±)
            </Label>
            <Input
              id="adj-points"
              inputMode="numeric"
              className="w-20"
              placeholder="+5 / -3"
              value={points}
              onChange={(e) =>
                setPoints(e.target.value.replace(/[^0-9-]/g, ""))
              }
            />
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <Label className="text-xs" htmlFor="adj-reason">
              Motif
            </Label>
            <Input
              id="adj-reason"
              maxLength={200}
              placeholder="Fair-play, retard de paiement…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={pending} onClick={onAdd}>
            Ajouter
          </Button>
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}

        {adjustments.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {adjustments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between border-b py-1.5 last:border-0"
              >
                <span>
                  <span
                    className={
                      a.points >= 0 ? "text-green-600" : "text-destructive"
                    }
                  >
                    {a.points >= 0 ? `+${a.points}` : a.points}
                  </span>{" "}
                  <span className="font-medium">{a.memberName}</span>
                  <span className="text-muted-foreground"> — {a.reason}</span>
                </span>
                <button
                  type="button"
                  aria-label="Supprimer l'ajustement"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => onRemove(a.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
