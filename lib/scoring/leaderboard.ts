// Client-safe leaderboard types + ordering (no server imports).

export type LeaderboardRow = {
  userId: string;
  displayName: string;
  points: number;
  exact: number;
  diff: number;
  outcome: number;
  adjustments: number;
};

/** Deterministic ranking: points → more exact scores → more diffs → name. */
export function compareLeaderboard(a: LeaderboardRow, b: LeaderboardRow): number {
  return (
    b.points - a.points ||
    b.exact - a.exact ||
    b.diff - a.diff ||
    a.displayName.localeCompare(b.displayName)
  );
}
