"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { saveGroupRanking } from "@/lib/predictions/actions";

export type PredictGroup = {
  id: string;
  name: string;
  teams: { id: string; name: string }[];
  lockAt: string | null; // earliest kickoff of the group's matches
};

export type InitialRanking = { ranking: string[]; version: number };

function deviceId(): string {
  const KEY = "predix_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function GroupRankingClient({
  groups,
  initial,
}: {
  groups: PredictGroup[];
  initial: Record<string, InitialRanking>;
}) {
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <GroupCard key={g.id} group={g} initial={initial[g.id] ?? null} />
      ))}
    </div>
  );
}

function GroupCard({
  group,
  initial,
}: {
  group: PredictGroup;
  initial: InitialRanking | null;
}) {
  const n = group.teams.length;
  // position (1..n) per team id; start from the saved ranking or blank
  const initialPos: Record<string, number> = {};
  if (initial) {
    initial.ranking.forEach((tid, i) => {
      initialPos[tid] = i + 1;
    });
  }
  const [pos, setPos] = useState<Record<string, number>>(initialPos);
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
    group.lockAt !== null &&
    new Date(group.lockAt).getTime() <= now;

  const chosen = Object.values(pos).filter((p) => p >= 1 && p <= n);
  const complete =
    chosen.length === n && new Set(chosen).size === n;

  function setPosition(teamId: string, value: number) {
    setStatus("idle");
    setPos((p) => ({ ...p, [teamId]: value }));
  }

  function onSave() {
    if (!complete) return;
    const ranking = [...group.teams]
      .sort((a, b) => pos[a.id] - pos[b.id])
      .map((t) => t.id);
    startTransition(async () => {
      const res = await saveGroupRanking({
        groupId: group.id,
        ranking,
        baseVersion: version,
        eventUuid: crypto.randomUUID(),
        deviceId: deviceId(),
        clientSentAt: new Date().toISOString(),
      });
      if (!res.ok) {
        setStatus("error");
        setMessage(res.error);
        return;
      }
      if (res.outcome === "accepted" || res.outcome === "replayed") {
        setVersion(res.version);
        setStatus("saved");
        setMessage(res.version ? `Enregistré • v${res.version}` : "Enregistré");
      } else if (res.outcome === "rejected_locked") {
        setStatus("error");
        setMessage("Trop tard : le groupe a commencé.");
      } else if (res.outcome === "rejected_conflict") {
        setStatus("error");
        setMessage("Modifié depuis un autre appareil — recharge la page.");
      } else {
        setStatus("error");
        setMessage("Classement refusé.");
      }
    });
  }

  const dirty =
    !initial ||
    [...group.teams].sort((a, b) => pos[a.id] - pos[b.id]).map((t) => t.id).join(",") !==
      initial.ranking.join(",");

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{group.name}</p>
        {locked && <Badge variant="secondary">Verrouillé</Badge>}
      </div>
      <ul className="flex flex-col gap-1.5">
        {group.teams.map((t) => (
          <li key={t.id} className="flex items-center justify-between gap-2">
            <span className="truncate text-sm">{t.name}</span>
            <select
              aria-label={`Position ${t.name}`}
              className="border-input bg-background h-8 rounded-md border px-2 text-sm disabled:opacity-50"
              value={pos[t.id] ?? ""}
              disabled={locked || pending}
              onChange={(e) => setPosition(t.id, Number(e.target.value))}
            >
              <option value="">—</option>
              {Array.from({ length: n }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  {p === 1 ? "1er" : `${p}e`}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {!locked && (
        <div className="flex min-h-7 items-center justify-between gap-2">
          <span
            className={
              status === "error"
                ? "text-destructive text-xs"
                : status === "saved"
                  ? "text-xs text-green-600"
                  : "text-muted-foreground text-xs"
            }
          >
            {status === "idle"
              ? complete
                ? ""
                : "Attribue une position à chaque équipe."
              : message}
          </span>
          <Button
            type="button"
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={pending || !complete || !dirty}
            onClick={onSave}
          >
            {pending ? "…" : "Enregistrer"}
          </Button>
        </div>
      )}
    </div>
  );
}
