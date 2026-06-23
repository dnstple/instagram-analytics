// Safe metric maths. Every helper returns `null` (rendered as "—") when an
// input is missing or would force a divide-by-zero. We NEVER fabricate zeroes.

import type { Maybe, OrganicMedia, OrganicSummary, ContentType } from "./types";

/** Sum numbers, ignoring nulls. Returns null only if EVERY input is null. */
export function safeSum(values: Maybe<number>[]): Maybe<number> {
  const present = values.filter((v): v is number => v !== null && v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

/** a / b, but null if either side is missing or denominator is 0. */
export function safeRate(a: Maybe<number>, b: Maybe<number>): Maybe<number> {
  if (a === null || a === undefined) return null;
  if (b === null || b === undefined || b === 0) return null;
  return a / b;
}

/** Weighted average over present values, weighted by `weight` (e.g. views). */
export function weightedAverage(
  pairs: { value: Maybe<number>; weight: Maybe<number> }[]
): Maybe<number> {
  let num = 0;
  let den = 0;
  for (const { value, weight } of pairs) {
    if (value === null || value === undefined) continue;
    const w = weight === null || weight === undefined ? 1 : weight;
    num += value * w;
    den += w;
  }
  return den === 0 ? null : num / den;
}

/**
 * engagement = likes + comments + shares + saves  (any present subset)
 * Returns null only when none of the four are available.
 */
export function computeEngagement(m: {
  likes: Maybe<number>;
  comments: Maybe<number>;
  shares: Maybe<number>;
  saves: Maybe<number>;
}): Maybe<number> {
  return safeSum([m.likes, m.comments, m.shares, m.saves]);
}

/** Map Meta media_type / media_product_type to a UI content type. */
export function classifyContentType(
  mediaType: Maybe<string>,
  productType: Maybe<string>
): ContentType {
  if (productType === "REELS") return "REEL";
  if (mediaType === "CAROUSEL_ALBUM") return "CAROUSEL";
  return "POST";
}

/** Attach engagement + all reach-relative rates to a media row. */
export function withDerivedOrganic(
  base: Omit<
    OrganicMedia,
    | "engagement"
    | "engagementRate"
    | "shareRate"
    | "saveRate"
    | "profileVisitRate"
    | "followRate"
  >
): OrganicMedia {
  const engagement = computeEngagement(base);
  // Engagement rate uses reach as the denominator per the brief.
  const engagementRate = safeRate(engagement, base.reach);
  const shareRate = safeRate(base.shares, base.reach);
  const saveRate = safeRate(base.saves, base.reach);
  const profileVisitRate = safeRate(base.profileVisits, base.reach);
  const followRate = safeRate(base.follows, base.reach);
  return {
    ...base,
    engagement,
    engagementRate,
    shareRate,
    saveRate,
    profileVisitRate,
    followRate,
  };
}

/** Roll a list of media into the organic KPI summary. */
export function summariseOrganic(media: OrganicMedia[]): OrganicSummary {
  const reels = media.filter((m) => m.contentType === "REEL");
  const views = safeSum(media.map((m) => m.views));
  const reach = safeSum(media.map((m) => m.reach));
  const engagements = safeSum(media.map((m) => m.engagement));
  const shares = safeSum(media.map((m) => m.shares));
  const saves = safeSum(media.map((m) => m.saves));

  return {
    contentPublished: media.length,
    reelsPublished: reels.length,
    views,
    reach,
    engagements,
    engagementRate: safeRate(engagements, reach),
    shares,
    shareRate: safeRate(shares, reach),
    saves,
    saveRate: safeRate(saves, reach),
    avgWatchTime: weightedAverage(
      reels.map((m) => ({ value: m.avgWatchTime, weight: m.views }))
    ),
  };
}

// ---- Formatting helpers (shared by client components) ----

export const NA = "—";

export function fmtInt(v: Maybe<number>): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NA;
  return Math.round(v).toLocaleString();
}

export function fmtPct(v: Maybe<number>, digits = 2): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NA;
  return `${(v * 100).toFixed(digits)}%`;
}

export function fmtMoney(v: Maybe<number>, currency = "USD"): string {
  if (v === null || v === undefined || Number.isNaN(v)) return NA;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(v);
}

export function fmtDuration(seconds: Maybe<number>): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds))
    return NA;
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m ${rem}s`;
}

export function fmtDate(iso: Maybe<string>): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
