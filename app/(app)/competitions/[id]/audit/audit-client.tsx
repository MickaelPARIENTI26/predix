"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { AuditEvent } from "@/lib/audit/queries";

const OUTCOME_LABELS: Record<string, string> = {
  accepted: "Accepté",
  rejected_locked: "Trop tard",
  rejected_conflict: "Conflit",
  rejected_invalid: "Invalide",
};

function outcomeClass(outcome: string): string {
  if (outcome === "accepted") return "text-green-600";
  if (outcome === "rejected_locked") return "text-amber-600";
  return "text-destructive";
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type Filter = "all" | "late" | "conflict";

export function AuditClient({ events }: { events: AuditEvent[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const shown = events.filter((e) => {
    if (filter === "late") return e.outcome === "rejected_locked";
    if (filter === "conflict") return e.outcome === "rejected_conflict";
    return true;
  });

  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "Tout" },
    { key: "late", label: "Tardifs" },
    { key: "conflict", label: "Conflits" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              filter === t.key
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">Aucune tentative.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {shown.map((e) => (
            <li
              key={e.id}
              className="flex flex-col gap-0.5 border-b py-1.5 text-sm last:border-0"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{e.memberName}</span>
                <span className={`text-xs ${outcomeClass(e.outcome)}`}>
                  {OUTCOME_LABELS[e.outcome] ?? e.outcome}
                  {e.resultingVersion ? ` • v${e.resultingVersion}` : ""}
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>
                  <Badge variant="secondary" className="mr-1">
                    {e.targetKind}
                  </Badge>
                  {e.targetLabel}
                </span>
                <span>{fmt(e.serverReceivedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
