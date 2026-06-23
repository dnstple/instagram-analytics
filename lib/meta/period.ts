// Pure helpers for the time-normalised comparison period. Client-safe.
// Resolves "what did this post look like in its first 24h / 3d / 7d / 30d"
// from stored snapshots — never fabricates history.

import type { Snapshot } from "./types";

export type PeriodKey = "h24" | "d3" | "d7" | "d30" | "lifetime";

export const PERIODS: { key: PeriodKey; label: string; hours: number }[] = [
  { key: "h24", label: "First 24 hours", hours: 24 },
  { key: "d3", label: "First 3 days", hours: 72 },
  { key: "d7", label: "First 7 days", hours: 168 },
  { key: "d30", label: "First 30 days", hours: 720 },
  { key: "lifetime", label: "Lifetime", hours: Infinity },
];

export function periodLabel(key: PeriodKey): string {
  return PERIODS.find((p) => p.key === key)?.label ?? "Lifetime";
}

export type PeriodStatus = "ok" | "lifetime_only" | "pending";

export interface PeriodResult {
  status: PeriodStatus;
  snapshot: Snapshot | null;
}

/**
 * Find the snapshot that best represents the post at `period` age.
 * - lifetime: caller uses live values (returns status "ok", snapshot null).
 * - pending: the post isn't old enough for this period yet.
 * - lifetime_only: no snapshot near that age exists (e.g. older posts that
 *   predate snapshot tracking).
 */
export function resolvePeriod(
  snaps: Snapshot[] | undefined,
  period: PeriodKey,
  postTimestamp: string,
  now: number = Date.now()
): PeriodResult {
  if (period === "lifetime") return { status: "ok", snapshot: null };

  const target = PERIODS.find((p) => p.key === period)!.hours;
  const ageNow = (now - new Date(postTimestamp).getTime()) / 3_600_000;
  if (ageNow < target) return { status: "pending", snapshot: null };

  if (!snaps || snaps.length === 0)
    return { status: "lifetime_only", snapshot: null };

  // Pick the snapshot whose ageHours is closest to the target window.
  let best: Snapshot | null = null;
  let bestDelta = Infinity;
  for (const s of snaps) {
    const delta = Math.abs(s.ageHours - target);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = s;
    }
  }
  // Accept only if within a sensible tolerance of the window
  // (half the window, capped at +/- 36h) so we don't mislabel.
  const tolerance = Math.min(target * 0.5, 36);
  if (best && bestDelta <= tolerance) return { status: "ok", snapshot: best };
  return { status: "lifetime_only", snapshot: null };
}
