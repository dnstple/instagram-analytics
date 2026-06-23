// Pure aggregation for the Insights page. Client-safe. Null-aware throughout.

import { average, BENCH_GROUP_LABEL, paidWinnerScore, type BenchGroup, type EnrichedMedia } from "./scoring";
import type { Maybe } from "./types";

// ---- Content-type comparison ----
export interface TypeRow {
  group: BenchGroup;
  label: string;
  count: number;
  avgViews: Maybe<number>;
  avgReach: Maybe<number>;
  avgEngagementRate: Maybe<number>;
  avgShareRate: Maybe<number>;
  avgSaveRate: Maybe<number>;
  avgProfileVisits: Maybe<number>;
  avgFollows: Maybe<number>;
  avgWatchTime: Maybe<number>;
  avgScore: Maybe<number>;
}

export function contentTypeComparison(media: EnrichedMedia[]): TypeRow[] {
  const groups: BenchGroup[] = ["REEL", "CAROUSEL", "IMAGE", "VIDEO"];
  return groups
    .map((g) => {
      const items = media.filter((m) => m.group === g);
      if (items.length === 0) return null;
      return {
        group: g,
        label: BENCH_GROUP_LABEL[g],
        count: items.length,
        avgViews: average(items.map((m) => m.views)),
        avgReach: average(items.map((m) => m.reach)),
        avgEngagementRate: average(items.map((m) => m.engagementRate)),
        avgShareRate: average(items.map((m) => m.shareRate)),
        avgSaveRate: average(items.map((m) => m.saveRate)),
        avgProfileVisits: average(items.map((m) => m.profileVisits)),
        avgFollows: average(items.map((m) => m.follows)),
        avgWatchTime: average(items.map((m) => m.avgWatchTime)),
        avgScore: average(items.map((m) => m.score)),
      } as TypeRow;
    })
    .filter((x): x is TypeRow => x !== null);
}

// ---- Tag performance ----
export interface TagRow {
  tag: string;
  count: number;
  avgViews: Maybe<number>;
  avgEngagementRate: Maybe<number>;
  avgShareRate: Maybe<number>;
  avgSaveRate: Maybe<number>;
  avgProfileVisits: Maybe<number>;
  avgFollows: Maybe<number>;
  avgScore: Maybe<number>;
}

export function tagPerformance(media: EnrichedMedia[]): TagRow[] {
  const tags = new Set<string>();
  media.forEach((m) => m.tags.forEach((t) => tags.add(t)));
  return Array.from(tags)
    .map((tag) => {
      const items = media.filter((m) => m.tags.includes(tag));
      return {
        tag,
        count: items.length,
        avgViews: average(items.map((m) => m.views)),
        avgEngagementRate: average(items.map((m) => m.engagementRate)),
        avgShareRate: average(items.map((m) => m.shareRate)),
        avgSaveRate: average(items.map((m) => m.saveRate)),
        avgProfileVisits: average(items.map((m) => m.profileVisits)),
        avgFollows: average(items.map((m) => m.follows)),
        avgScore: average(items.map((m) => m.score)),
      } as TagRow;
    })
    .sort((a, b) => (b.avgScore ?? -1) - (a.avgScore ?? -1));
}

// ---- Best posting windows ----
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface WindowResult {
  bestDay: Maybe<string>;
  bestHour: Maybe<string>;
  byType: { label: string; bestDay: Maybe<string>; bestHour: Maybe<string> }[];
}

function bestBucket<T>(
  items: EnrichedMedia[],
  bucket: (d: Date) => T,
  fmt: (t: T) => string
): Maybe<string> {
  const map = new Map<string, { sum: number; n: number }>();
  for (const m of items) {
    if (m.score === null) continue;
    const key = fmt(bucket(new Date(m.timestamp)));
    const cur = map.get(key) ?? { sum: 0, n: 0 };
    cur.sum += m.score;
    cur.n += 1;
    map.set(key, cur);
  }
  let best: string | null = null;
  let bestAvg = -Infinity;
  for (const [k, v] of map) {
    const avg = v.sum / v.n;
    if (avg > bestAvg) {
      bestAvg = avg;
      best = k;
    }
  }
  return best;
}

export function postingWindows(media: EnrichedMedia[]): WindowResult {
  const day = (d: Date) => DAYS[d.getDay()];
  const hour = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:00`;
  const groups: BenchGroup[] = ["REEL", "CAROUSEL", "IMAGE", "VIDEO"];
  return {
    bestDay: bestBucket(media, day, (x) => x),
    bestHour: bestBucket(media, hour, (x) => x),
    byType: groups
      .map((g) => {
        const items = media.filter((m) => m.group === g);
        if (items.length < 2) return null;
        return {
          label: BENCH_GROUP_LABEL[g],
          bestDay: bestBucket(items, day, (x) => x),
          bestHour: bestBucket(items, hour, (x) => x),
        };
      })
      .filter((x): x is WindowResult["byType"][number] => x !== null),
  };
}

// ---- Opportunities (rule-based) ----
export interface Opportunity {
  tone: "good" | "watch" | "info";
  title: string;
  detail: string;
}

function bestGroupBy(
  rows: TypeRow[],
  pick: (r: TypeRow) => Maybe<number>
): TypeRow | null {
  let best: TypeRow | null = null;
  for (const r of rows) {
    const v = pick(r);
    if (v === null) continue;
    if (!best || (pick(best) ?? -Infinity) < v) best = r;
  }
  return best;
}

export function opportunities(media: EnrichedMedia[]): Opportunity[] {
  const out: Opportunity[] = [];
  const types = contentTypeComparison(media);
  const tags = tagPerformance(media).filter((t) => t.count >= 2);

  type PctKey =
    | "reach"
    | "engagementRate"
    | "shareRate"
    | "saveRate"
    | "profileVisitRate"
    | "followRate";
  const pct = (m: EnrichedMedia, k: PctKey) => m.benchmarks[k].percentile;

  const highReachLowEng = media.filter(
    (m) => (pct(m, "reach") ?? 0) >= 70 && pct(m, "engagementRate") !== null && (pct(m, "engagementRate") as number) <= 40
  );
  if (highReachLowEng.length)
    out.push({
      tone: "watch",
      title: "High reach, weak engagement",
      detail: `${highReachLowEng.length} post(s) reached a lot of people but under-engaged for that reach. Review hooks/format.`,
    });

  const highSharesLowVisits = media.filter(
    (m) => (pct(m, "shareRate") ?? 0) >= 70 && pct(m, "profileVisitRate") !== null && (pct(m, "profileVisitRate") as number) <= 40
  );
  if (highSharesLowVisits.length)
    out.push({
      tone: "watch",
      title: "High shares, low profile visits",
      detail: `${highSharesLowVisits.length} post(s) get shared but don't pull people to your profile. Add a clearer CTA or hook.`,
    });

  const highSavesLowReach = media.filter(
    (m) => (pct(m, "saveRate") ?? 0) >= 70 && pct(m, "reach") !== null && (pct(m, "reach") as number) <= 40
  );
  if (highSavesLowReach.length)
    out.push({
      tone: "good",
      title: "High saves, limited reach",
      detail: `${highSavesLowReach.length} post(s) are highly saved but under-distributed — strong candidates to boost so more people see them.`,
    });

  const reels = media.filter((m) => m.group === "REEL");
  const watchLowFollow = reels.filter(
    (m) => (m.benchmarks.engagementRate.percentile ?? 0) >= 60 && (m.benchmarks.followRate.percentile ?? 101) <= 40 && m.avgWatchTime !== null
  );
  if (watchLowFollow.length)
    out.push({
      tone: "watch",
      title: "Held attention but few follows",
      detail: `${watchLowFollow.length} Reel(s) kept watch time/engagement up but converted few follows. Strengthen who-you-are framing.`,
    });

  const promote = media.filter((m) => paidWinnerScore(m) !== null);
  if (promote.length)
    out.push({
      tone: "good",
      title: "Strong organic posts worth promoting",
      detail: `${promote.length} post(s) already convert well organically — see the “Potential paid winner” ranking on the dashboard.`,
    });

  const shareLeader = bestGroupBy(types, (r) => r.avgShareRate);
  if (shareLeader)
    out.push({ tone: "info", title: "Best content type for shares", detail: `${shareLeader.label} lead on average share rate.` });
  const saveLeader = bestGroupBy(types, (r) => r.avgSaveRate);
  if (saveLeader)
    out.push({ tone: "info", title: "Best content type for saves", detail: `${saveLeader.label} lead on average save rate.` });
  const visitLeader = bestGroupBy(types, (r) => r.avgProfileVisits);
  if (visitLeader)
    out.push({ tone: "info", title: "Best content type for profile visits", detail: `${visitLeader.label} drive the most profile visits on average.` });

  if (tags.length) {
    const top = tags[0];
    const bottom = tags[tags.length - 1];
    if (top.avgScore !== null)
      out.push({ tone: "good", title: "High-performing theme", detail: `“${top.tag}” has your best average score across ${top.count} posts — make more.` });
    if (tags.length > 1 && bottom.avgScore !== null)
      out.push({ tone: "watch", title: "Weak-performing theme", detail: `“${bottom.tag}” underperforms on average — reconsider or refresh the format.` });
  }

  if (out.length === 0)
    out.push({ tone: "info", title: "Keep posting", detail: "Not enough signal yet for opportunity rules. They sharpen as more content and snapshots accumulate." });
  return out;
}
