"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BONUS_LABELS, bonusPicksTeam, type BonusKind } from "@/lib/schemas/prediction";
import { saveBonusPrediction } from "@/lib/bonus/actions";

export type BonusItem = {
  questionId: string;
  kind: BonusKind;
  lockAt: string | null;
};
export type PickOption = { id: string; name: string };

function deviceId(): string {
  const KEY = "predix_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function BonusClient({
  questions,
  players,
  teams,
  initial,
}: {
  questions: BonusItem[];
  players: PickOption[];
  teams: PickOption[];
  initial: Record<string, { pick: string; version: number }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      {questions.map((q) => (
        <BonusRow
          key={q.questionId}
          item={q}
          options={bonusPicksTeam(q.kind) ? teams : players}
          initial={initial[q.questionId] ?? null}
        />
      ))}
    </div>
  );
}

function BonusRow({
  item,
  options,
  initial,
}: {
  item: BonusItem;
  options: PickOption[];
  initial: { pick: string; version: number } | null;
}) {
  const [pick, setPick] = useState(initial?.pick ?? "");
  const [version, setVersion] = useState<number | null>(initial?.version ?? null);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);
  const locked =
    now !== null &&
    item.lockAt !== null &&
    new Date(item.lockAt).getTime() <= now;
  const dirty = pick !== (initial?.pick ?? "");

  function onSave() {
    if (!pick) return;
    startTransition(async () => {
      const res = await saveBonusPrediction({
        questionId: item.questionId,
        kind: item.kind,
        pickId: pick,
        baseVersion: version,
        eventUuid: crypto.randomUUID(),
        deviceId: deviceId(),
        clientSentAt: new Date().toISOString(),
      });
      if (!res.ok) {
        setStatus("error");
        setMessage(res.error);
      } else if (res.outcome === "accepted" || res.outcome === "replayed") {
        setVersion(res.version);
        setStatus("saved");
        setMessage(res.version ? `Enregistré • v${res.version}` : "Enregistré");
      } else if (res.outcome === "rejected_locked") {
        setStatus("error");
        setMessage("Trop tard.");
      } else if (res.outcome === "rejected_conflict") {
        setStatus("error");
        setMessage("Modifié ailleurs — recharge la page.");
      } else {
        setStatus("error");
        setMessage("Choix refusé.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{BONUS_LABELS[item.kind]}</p>
        {locked && <Badge variant="secondary">Verrouillé</Badge>}
      </div>
      <div className="flex items-center gap-2">
        <select
          aria-label={BONUS_LABELS[item.kind]}
          className="border-input bg-background h-9 flex-1 rounded-md border px-2 text-sm disabled:opacity-50"
          value={pick}
          disabled={locked || pending}
          onChange={(e) => {
            setPick(e.target.value);
            setStatus("idle");
          }}
        >
          <option value="">— choisir —</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {!locked && (
          <Button
            type="button"
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={pending || !pick || !dirty}
            onClick={onSave}
          >
            {pending ? "…" : "Enregistrer"}
          </Button>
        )}
      </div>
      {!locked && status !== "idle" && (
        <span
          className={
            status === "saved" ? "text-xs text-green-600" : "text-destructive text-xs"
          }
        >
          {message}
        </span>
      )}
    </div>
  );
}
