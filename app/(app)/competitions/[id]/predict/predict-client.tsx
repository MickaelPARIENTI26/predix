"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseScoreInput } from "@/lib/schemas/prediction";
import {
  saveScorePrediction,
  type SaveResult,
} from "@/lib/predictions/actions";

export type PredictMatch = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  stageLabel: string;
};

export type InitialPrediction = { home: number; away: number; version: number };

function deviceId(): string {
  const KEY = "predix_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PredictClient({
  matches,
  initial,
}: {
  matches: PredictMatch[];
  initial: Record<string, InitialPrediction>;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {matches.map((m) => (
        <li key={m.id}>
          <MatchRow match={m} initial={initial[m.id] ?? null} />
        </li>
      ))}
    </ul>
  );
}

function MatchRow({
  match,
  initial,
}: {
  match: PredictMatch;
  initial: InitialPrediction | null;
}) {
  const [home, setHome] = useState(initial ? String(initial.home) : "");
  const [away, setAway] = useState(initial ? String(initial.away) : "");
  const [version, setVersion] = useState<number | null>(initial?.version ?? null);
  const [savedHome, setSavedHome] = useState(initial ? String(initial.home) : "");
  const [savedAway, setSavedAway] = useState(initial ? String(initial.away) : "");
  const [status, setStatus] = useState<
    "idle" | "saved" | "conflict" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState<number | null>(null);
  const uuidRef = useRef<string>("");

  // Client-side lock display only; the RPC is the authority. Tick so a match
  // that kicks off while the page is open flips to locked.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // deferred (not a synchronous effect setState)
    const interval = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, []);
  const locked = now !== null && new Date(match.kickoffAt).getTime() <= now;
  const dirty = home !== savedHome || away !== savedAway;
  const valid = parseScoreInput(home) !== null && parseScoreInput(away) !== null;

  function onSave() {
    const h = parseScoreInput(home);
    const a = parseScoreInput(away);
    if (h === null || a === null) {
      setStatus("error");
      setMessage("Score entre 0 et 99.");
      return;
    }
    // One idempotency key per save intent; reused if this exact save is retried.
    if (!uuidRef.current) uuidRef.current = crypto.randomUUID();
    startTransition(async () => {
      const res: SaveResult = await saveScorePrediction({
        matchId: match.id,
        home: h,
        away: a,
        baseVersion: version,
        eventUuid: uuidRef.current,
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
        setSavedHome(String(h));
        setSavedAway(String(a));
        setStatus("saved");
        setMessage(res.version ? `Enregistré • v${res.version}` : "Enregistré");
        uuidRef.current = "";
      } else if (res.outcome === "rejected_locked") {
        setStatus("error");
        setMessage("Trop tard : le match a commencé.");
        uuidRef.current = "";
      } else if (res.outcome === "rejected_conflict") {
        setStatus("conflict");
        if (res.currentPayload) {
          setHome(String(res.currentPayload.home));
          setAway(String(res.currentPayload.away));
          setSavedHome(String(res.currentPayload.home));
          setSavedAway(String(res.currentPayload.away));
          setVersion(res.currentVersion);
        }
        setMessage("Modifié depuis un autre appareil — valeur rechargée.");
        uuidRef.current = "";
      } else {
        setStatus("error");
        setMessage("Score refusé.");
        uuidRef.current = "";
      }
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
          aria-label={`Score ${match.homeTeam}`}
          inputMode="numeric"
          className="w-12 text-center"
          maxLength={2}
          value={home}
          disabled={locked || pending}
          onChange={(e) => setHome(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          aria-label={`Score ${match.awayTeam}`}
          inputMode="numeric"
          className="w-12 text-center"
          maxLength={2}
          value={away}
          disabled={locked || pending}
          onChange={(e) => setAway(e.target.value.replace(/[^0-9]/g, ""))}
        />
        <span className="flex-1 truncate text-sm font-medium">
          {match.awayTeam}
        </span>
      </div>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span
          className={
            status === "error"
              ? "text-destructive text-xs"
              : status === "conflict"
                ? "text-xs text-amber-600"
                : status === "saved"
                  ? "text-xs text-green-600"
                  : "text-muted-foreground text-xs"
          }
        >
          {locked
            ? version
              ? `Verrouillé • pronostic v${version}`
              : "Verrouillé"
            : message}
        </span>
        {!locked && (
          <Button
            type="button"
            size="sm"
            variant={dirty ? "default" : "outline"}
            disabled={pending || !dirty || !valid}
            onClick={onSave}
          >
            {pending ? "…" : "Enregistrer"}
          </Button>
        )}
        {locked && !version && <Badge variant="secondary">Non joué</Badge>}
      </div>
    </div>
  );
}
