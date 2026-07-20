"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LeaderboardRow } from "@/lib/scoring/queries";

function sortRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort(
    (a, b) => b.points - a.points || a.displayName.localeCompare(b.displayName)
  );
}

export function LeaderboardClient({
  competitionId,
  currentUserId,
  initialRows,
}: {
  competitionId: string;
  currentUserId: string;
  initialRows: LeaderboardRow[];
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>(initialRows);
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function refetch() {
      const { data } = await supabase
        .from("scores")
        .select("user_id, points, breakdown")
        .eq("competition_id", competitionId);
      const byUser = new Map((data ?? []).map((s) => [s.user_id, s]));
      setRows((prev) =>
        sortRows(
          prev.map((r) => {
            const s = byUser.get(r.userId);
            const bd = (s?.breakdown ?? {}) as {
              exact?: number;
              diff?: number;
              outcome?: number;
              adjustments?: number;
            };
            return {
              ...r,
              points: s?.points ?? 0,
              exact: bd.exact ?? 0,
              diff: bd.diff ?? 0,
              outcome: bd.outcome ?? 0,
              adjustments: bd.adjustments ?? 0,
            };
          })
        )
      );
    }

    // debounce the DELETE+INSERT burst recompute produces into one refetch
    function scheduleRefetch() {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refetch, 400);
    }

    const channel = supabase
      .channel(`scores:${competitionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `competition_id=eq.${competitionId}`,
        },
        scheduleRefetch
      )
      .subscribe((status) => {
        setLive(status === "SUBSCRIBED");
      });

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [competitionId]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span
          className={`inline-block size-2 rounded-full ${
            live ? "bg-green-500" : "bg-muted-foreground/40"
          }`}
          aria-hidden
        />
        {live ? "En direct" : "Connexion…"}
      </div>
      <ol className="flex flex-col">
        {rows.map((r, i) => (
          <li
            key={r.userId}
            className={`flex items-center justify-between border-b py-2 last:border-0 ${
              r.userId === currentUserId ? "font-semibold" : ""
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="text-muted-foreground w-6 text-right tabular-nums">
                {i + 1}
              </span>
              <span>{r.displayName}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="text-muted-foreground hidden text-xs sm:inline">
                {r.exact} exact · {r.diff} écart · {r.outcome} rés.
                {r.adjustments !== 0 &&
                  ` · ${r.adjustments > 0 ? "+" : ""}${r.adjustments} ajust.`}
              </span>
              <span className="tabular-nums font-medium">{r.points} pts</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
