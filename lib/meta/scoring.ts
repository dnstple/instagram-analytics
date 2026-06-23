// Pure scoring / benchmarking engine. Client-safe (imports only types + maths).
// Everything here is transparent and rule-based — no opaque "AI" judgements.
// Missing metrics are treated as null and excluded from maths (never zero).

import { safeRate } from "./metrics";
import type { Maybe, OrganicMedia } from "./types";

// ---- Benchmark group (comparable content only) ----
// Reels vs Reels, Carousels vs Carousels, image posts vs image posts,
// video posts vs video posts.
export type BenchGroup = "REEL" | "CAROUSEL" | "IMAGE" | "VIDEO";

export function benchGroup(m: OrganicMedia): BenchGroup {
  if (m.contentType === "REEL") return "REEL";
  if (m.contentType === "CAROUSEL") return "CAROUSEL";
  if (m.mediaType === "VIDEO") return "VIDEO";
  return "IMAGE";
}

export const BENCH_GROUP_LABEL: Record<BenchGroup, string> = {
  REEL: "Reels",
  CAROUSEL: "Carousels",
  IMAGE: "Image posts",
  VIDEO: "Video posts",
};

// ---- Overall score weights (fixed defaults for now) ----
export interface ScoreWeight {
  key: RateKey;
  weight: number;
  label: string;
}

export type RateKey =
  | "engagementRate"
  | "shareRate"
  | "saveRate"
  | "profileVisitRate"
  | "followRate";

export const SCORE_WEIGHTS: ScoreWeight[] = [
  { key: "engagementRate", weight: 0.3, label: "Engagement rate" },
  { key: "shareRate", weight: 0.25, label: "Share rate" },
  { key: "saveRate", weight: 0.2, label: "Save rate" },
  { key: "profileVisitRate", weight: 0.15, label: "Profile-visit rate" },
  { key: "followRate", weight: 0.1, label: "Follow rate" },
];

// ---- One benchmarked field ----
export interface Benchmark {
  value: Maybe<number>;
  avg: Maybe<number>; // group average (present values only)
  ratio: Maybe<number>; // value / avg
  percentile: Maybe<number>; // 0-100 within group (higher = better)
}

export interface EnrichedMedia extends OrganicMedia {
  group: BenchGroup;
  tags: string[];
  // Overall score (0-100, weighted percentile blend) within the group.
  score: Maybe<number>;
  scorePercentile: Maybe<number>;
  performancePercentile: Maybe<number>; // by engagement rate within group
  benchmarks: Record<BenchKey, Benchmark>;
}

export type BenchKey =
  | "views"
  | "reach"
  | "engagementRate"
  | "shareRate"
  | "saveRate"
  | "profileVisitRate"
  | "followRate";

const BENCH_KEYS: BenchKey[] = [
  "views",
  "reach",
  "engagementRate",
  "shareRate",
  "saveRate",
  "profileVisitRate",
  "followRate",
];

// ---- Stats helpers (null-aware) ----
function present(values: Maybe<number>[]): number[] {
  return values.filter((v): v is number => v !== null && v !== undefined);
}

export function average(values: Maybe<number>[]): Maybe<number> {
  const p = present(values);
  if (p.length === 0) return null;
  return p.reduce((a, b) => a + b, 0) / p.length;
}

/** Percentile rank of v within values (0-100). null if v or pool missing. */
export function percentileRank(
  values: Maybe<number>[],
  v: Maybe<number>
): Maybe<number> {
  if (v === null || v === undefined) return null;
  const p = present(values);
  if (p.length <= 1) return p.length === 1 ? 100 : null;
  const below = p.filter((x) => x < v).length;
  const equal = p.filter((x) => x === v).length;
  // Mid-rank for ties.
  return ((below + equal / 2) / p.length) * 100;
}

// ---- Labels ----
export function percentileLabel(p: Maybe<number>): string {
  if (p === null || p === undefined) return "—";
  if (p >= 95) return "Top 5%";
  if (p >= 90) return "Top 10%";
  if (p >= 75) return "Top 25%";
  if (p >= 55) return "Above average";
  if (p >= 45) return "Average";
  return "Below average";
}

export function ratioLabel(ratio: Maybe<number>): string {
  if (ratio === null || ratio === undefined) return "—";
  if (ratio >= 2) return `${ratio.toFixed(1)}x average`;
  if (ratio > 1.1) return `${Math.round((ratio - 1) * 100)}% above average`;
  if (ratio >= 0.9) return "Around average";
  return `${Math.round((1 - ratio) * 100)}% below average`;
}

// ---- Enrichment: compute benchmarks + score for a media set ----
export function enrich(
  media: OrganicMedia[],
  tagsMap: Record<string, string[]> = {}
): EnrichedMedia[] {
  // Bucket by benchmark group.
  const groups = new Map<BenchGroup, OrganicMedia[]>();
  for (const m of media) {
    const g = benchGroup(m);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(m);
  }

  // Pre-compute group pools for each benched field.
  const pools = new Map<BenchGroup, Record<BenchKey, Maybe<number>[]>>();
  for (const [g, items] of groups) {
    const rec = {} as Record<BenchKey, Maybe<number>[]>;
    for (const key of BENCH_KEYS) rec[key] = items.map((m) => valueOf(m, key));
    pools.set(g, rec);
  }

  // First pass: benchmarks + raw score per item.
  const scored = media.map((m) => {
    const g = benchGroup(m);
    const pool = pools.get(g)!;
    const benchmarks = {} as Record<BenchKey, Benchmark>;
    for (const key of BENCH_KEYS) {
      const value = valueOf(m, key);
      const avg = average(pool[key]);
      benchmarks[key] = {
        value,
        avg,
        ratio: safeRate(value, avg),
        percentile: percentileRank(pool[key], value),
      };
    }
    const score = overallScore(benchmarks);
    return { m, g, benchmarks, score };
  });

  // Second pass: percentile of score + performance within group.
  const scorePools = new Map<BenchGroup, Maybe<number>[]>();
  const erPools = new Map<BenchGroup, Maybe<number>[]>();
  for (const s of scored) {
    if (!scorePools.has(s.g)) scorePools.set(s.g, []);
    if (!erPools.has(s.g)) erPools.set(s.g, []);
    scorePools.get(s.g)!.push(s.score);
    erPools.get(s.g)!.push(s.m.engagementRate);
  }

  return scored.map((s) => ({
    ...s.m,
    group: s.g,
    tags: tagsMap[s.m.id] ?? [],
    score: s.score,
    scorePercentile: percentileRank(scorePools.get(s.g)!, s.score),
    performancePercentile: percentileRank(
      erPools.get(s.g)!,
      s.m.engagementRate
    ),
    benchmarks: s.benchmarks,
  }));
}

function valueOf(m: OrganicMedia, key: BenchKey): Maybe<number> {
  return (m[key as keyof OrganicMedia] as Maybe<number>) ?? null;
}

/**
 * Weighted overall score (0-100). Each component is the post's percentile for
 * that rate within its group. Weights renormalise over present components so a
 * missing metric never unfairly drags the score down.
 */
export function overallScore(
  benchmarks: Record<BenchKey, Benchmark>
): Maybe<number> {
  let num = 0;
  let den = 0;
  for (const w of SCORE_WEIGHTS) {
    const p = benchmarks[w.key as BenchKey]?.percentile;
    if (p === null || p === undefined) continue;
    num += w.weight * p;
    den += w.weight;
  }
  if (den === 0) return null;
  return num / den; // already on a 0-100 scale (percentile-weighted)
}

// ---- Best-performer ranking specs (drive the quick-rank chips) ----
export interface RankSpec {
  key: string;
  label: string;
  explanation: string;
  /** Comparable number for sorting. null => sorts to bottom. */
  value: (m: EnrichedMedia) => Maybe<number>;
  /** Which table column to highlight + sort by. */
  sortColumn: string;
  /** Sort direction the chip applies (default desc). */
  sortDesc?: boolean;
  /** Restrict to a content type (e.g. Reels for watch time). */
  onlyGroup?: BenchGroup;
  /** Optional extra row filter (e.g. only paid-winner candidates). */
  filter?: (m: EnrichedMedia) => boolean;
}

export const RANK_SPECS: RankSpec[] = [
  {
    key: "most_viewed",
    label: "Most viewed",
    explanation: "Ranking by total views (Meta-returned).",
    value: (m) => m.views,
    sortColumn: "views",
  },
  {
    key: "best_engagement_rate",
    label: "Best engagement rate",
    explanation: "Ranking by engagement ÷ reach.",
    value: (m) => m.engagementRate,
    sortColumn: "engagementRate",
  },
  {
    key: "most_shared",
    label: "Most shared",
    explanation: "Ranking by total shares.",
    value: (m) => m.shares,
    sortColumn: "shares",
  },
  {
    key: "best_share_rate",
    label: "Best share rate",
    explanation: "Ranking by shares ÷ reach.",
    value: (m) => m.shareRate,
    sortColumn: "shareRate",
  },
  {
    key: "most_saved",
    label: "Most saved",
    explanation: "Ranking by total saves.",
    value: (m) => m.saves,
    sortColumn: "saves",
  },
  {
    key: "best_save_rate",
    label: "Best save rate",
    explanation: "Ranking by saves ÷ reach.",
    value: (m) => m.saveRate,
    sortColumn: "saveRate",
  },
  {
    key: "most_profile_visits",
    label: "Most profile visits",
    explanation: "Ranking by profile visits driven (where Meta returns it).",
    value: (m) => m.profileVisits,
    sortColumn: "profileVisits",
  },
  {
    key: "most_follows",
    label: "Most follows",
    explanation: "Ranking by follows driven (where Meta returns it).",
    value: (m) => m.follows,
    sortColumn: "follows",
  },
  {
    key: "best_watch_time",
    label: "Best average watch time",
    explanation: "Ranking Reels by average watch time.",
    value: (m) => m.avgWatchTime,
    sortColumn: "avgWatchTime",
    onlyGroup: "REEL",
  },
  {
    key: "lowest_skip_rate",
    label: "Lowest skip rate",
    explanation: "Ranking by skip rate (lower is better) where available.",
    value: (m) => m.skipRate,
    sortColumn: "skipRate",
    sortDesc: false,
  },
  {
    key: "best_overall",
    label: "Best overall",
    explanation:
      "Weighted score vs comparable content: 30% engagement rate, 25% share rate, 20% save rate, 15% profile-visit rate, 10% follow rate.",
    value: (m) => m.score,
    sortColumn: "score",
  },
  {
    key: "paid_winner",
    label: "Potential paid winner",
    explanation:
      "Strong engagement for its reach AND saves/shares above its group average — organic proof worth boosting.",
    value: (m) => paidWinnerScore(m),
    sortColumn: "score",
    filter: (m) => paidWinnerScore(m) !== null,
  },
];

/**
 * "Potential paid winner": a post that already converts well organically.
 * High overall score, plus above-average share OR save rate. Posts that simply
 * went viral on reach without engagement are intentionally excluded.
 */
export function paidWinnerScore(m: EnrichedMedia): Maybe<number> {
  if (m.score === null) return null;
  const shareR = m.benchmarks.shareRate.ratio;
  const saveR = m.benchmarks.saveRate.ratio;
  const erR = m.benchmarks.engagementRate.ratio;
  const aboveAvg =
    (shareR !== null && shareR >= 1) ||
    (saveR !== null && saveR >= 1) ||
    (erR !== null && erR >= 1);
  if (!aboveAvg) return null;
  return m.score;
}

// ---- Rule-based post insights (factual, never vague) ----
export interface PostInsight {
  tone: "good" | "watch" | "info";
  text: string;
}

export function postInsights(m: EnrichedMedia): PostInsight[] {
  const out: PostInsight[] = [];
  const b = m.benchmarks;
  const g = BENCH_GROUP_LABEL[m.group].replace(/s$/, "");
  const p = (k: BenchKey) => b[k].percentile;
  const hi = (k: BenchKey, t = 80) => (p(k) ?? -1) >= t;
  const lo = (k: BenchKey, t = 40) => p(k) !== null && (p(k) as number) <= t;

  if (hi("shareRate", 90))
    out.push({ tone: "good", text: `Top 10% ${g} for share rate.` });
  if (hi("saveRate", 90))
    out.push({ tone: "good", text: `Top 10% ${g} for save rate.` });
  if (hi("engagementRate", 90))
    out.push({ tone: "good", text: `Top 10% ${g} for engagement rate.` });
  if (hi("reach", 70) && lo("engagementRate", 40))
    out.push({
      tone: "watch",
      text: "High reach but weak engagement for its reach.",
    });
  if (hi("saveRate", 70) && lo("reach", 40))
    out.push({ tone: "watch", text: "Strong saves but limited reach." });
  if (hi("profileVisitRate", 80))
    out.push({ tone: "good", text: "High profile-visit conversion." });
  if (hi("shareRate", 70) && lo("profileVisitRate", 40))
    out.push({ tone: "watch", text: "Shared a lot but few profile visits." });
  if (paidWinnerScore(m) !== null && (m.scorePercentile ?? 0) >= 70)
    out.push({
      tone: "good",
      text: "Strong organic proof — a candidate for paid promotion.",
    });
  if (out.length === 0)
    out.push({ tone: "info", text: `Around average for ${BENCH_GROUP_LABEL[m.group]}.` });
  return out;
}

/** Sort a list by a value fn, nulls always last, desc by default. */
export function rankBy(
  items: EnrichedMedia[],
  value: (m: EnrichedMedia) => Maybe<number>,
  dir: "asc" | "desc" = "desc"
): EnrichedMedia[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    const an = av === null || av === undefined;
    const bn = bv === null || bv === undefined;
    if (an && bn) return 0;
    if (an) return 1; // nulls to bottom regardless of direction
    if (bn) return -1;
    return factor * ((av as number) - (bv as number));
  });
}
