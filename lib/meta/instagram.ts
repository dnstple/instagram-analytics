// Organic Instagram data via the Instagram API with Instagram Login.
// Uses the graph.instagram.com host and an Instagram user access token.
// All calls run server-side. Returns rich, null-aware metrics for each media.

import "server-only";
import {
  graphGet,
  graphGetPaged,
  getConfig,
  IG_BASE,
  type MetaConfig,
} from "./client";
import { withCache } from "./cache";
import { captureSnapshots } from "./store";
import { classifyContentType, summariseOrganic, withDerivedOrganic } from "./metrics";
import type {
  ConnectionStatus,
  Maybe,
  OrganicMedia,
  OrganicResponse,
} from "./types";
import { MetaApiError } from "./types";

const MEDIA_FIELDS = [
  "id",
  "caption",
  "permalink",
  "timestamp",
  "media_type",
  "media_product_type",
  "thumbnail_url",
  "media_url",
  "like_count",
  "comments_count",
  "children{id,media_type,media_url,thumbnail_url}",
].join(",");

// Insight metrics we *try* for each media. Unsupported ones are dropped
// gracefully (see fetchInsights) so the request never hard-fails.
const COMMON_METRICS = [
  "reach",
  "shares",
  "saved",
  "total_interactions",
  "views",
  "profile_visits",
  "follows",
];
const REEL_METRICS = [...COMMON_METRICS, "ig_reels_avg_watch_time"];
const POST_METRICS = [...COMMON_METRICS, "impressions"];

interface RawMediaChild {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
}

interface RawMedia {
  id: string;
  caption?: string;
  permalink?: string;
  timestamp: string;
  media_type?: string;
  media_product_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
  children?: { data: RawMediaChild[] };
}

interface InsightEntry {
  name: string;
  values?: { value: number }[];
  total_value?: { value: number };
}

function readInsightValue(entry: InsightEntry): Maybe<number> {
  if (entry.total_value && typeof entry.total_value.value === "number") {
    return entry.total_value.value;
  }
  if (entry.values && entry.values.length > 0) {
    const v = entry.values[0]?.value;
    return typeof v === "number" ? v : null;
  }
  return null;
}

/**
 * Fetch insights for a single media, dropping any metric Meta rejects.
 * Meta returns a #100 error naming the unsupported metric(s); we strip those
 * and retry until the request succeeds or no metrics remain.
 */
async function fetchInsights(
  mediaId: string,
  candidates: string[],
  cfg: MetaConfig
): Promise<Record<string, Maybe<number>>> {
  let metrics = [...candidates];
  const result: Record<string, Maybe<number>> = {};

  for (let attempt = 0; attempt < 8 && metrics.length > 0; attempt++) {
    try {
      const json = await graphGet<{ data: InsightEntry[] }>(
        `${mediaId}/insights`,
        { metric: metrics.join(",") },
        cfg,
        IG_BASE
      );
      for (const entry of json.data ?? []) {
        result[entry.name] = readInsightValue(entry);
      }
      return result;
    } catch (e) {
      if (!(e instanceof MetaApiError)) throw e;
      // Drop any candidate metric mentioned in the error message.
      const msg = e.message || "";
      const offending = metrics.filter((m) => msg.includes(m));
      if (offending.length > 0) {
        metrics = metrics.filter((m) => !offending.includes(m));
      } else {
        // Couldn't identify the culprit — drop the last metric and retry.
        metrics = metrics.slice(0, -1);
      }
    }
  }
  return result; // possibly empty -> all metrics render as "—"
}

function toOrganicMedia(
  raw: RawMedia,
  insights: Record<string, Maybe<number>>
): OrganicMedia {
  const contentType = classifyContentType(
    raw.media_type ?? null,
    raw.media_product_type ?? null
  );

  // ig_reels_avg_watch_time is returned in milliseconds.
  const rawWatch = insights["ig_reels_avg_watch_time"];
  const avgWatchTime =
    rawWatch === null || rawWatch === undefined ? null : rawWatch / 1000;

  return withDerivedOrganic({
    id: raw.id,
    caption: raw.caption ?? null,
    permalink: raw.permalink ?? null,
    timestamp: raw.timestamp,
    mediaType: raw.media_type ?? null,
    productType: raw.media_product_type ?? null,
    contentType,
    thumbnailUrl: raw.thumbnail_url ?? raw.media_url ?? null,
    mediaUrl: raw.media_url ?? null,
    children: (raw.children?.data ?? []).map((c) => ({
      id: c.id,
      mediaType: c.media_type ?? null,
      mediaUrl: c.media_url ?? null,
      thumbnailUrl: c.thumbnail_url ?? c.media_url ?? null,
    })),
    views: insights["views"] ?? null,
    reach: insights["reach"] ?? null,
    impressions: insights["impressions"] ?? null,
    likes: raw.like_count ?? null,
    comments: raw.comments_count ?? null,
    shares: insights["shares"] ?? null,
    saves: insights["saved"] ?? null,
    totalInteractions: insights["total_interactions"] ?? null,
    profileVisits: insights["profile_visits"] ?? null,
    follows: insights["follows"] ?? null,
    avgWatchTime,
    // Meta does not return video length per media, so watch-% isn't derivable
    // and skip rate isn't exposed -> both stay null ("Not available").
    avgWatchPct: null,
    skipRate: insights["skip_rate"] ?? null,
  });
}

/** Core fetch (uncached). Pulls media + per-media insights. */
async function fetchOrganic(limit = 50): Promise<OrganicMedia[]> {
  const cfg = getConfig();
  // With an Instagram-login token, "me" resolves to the token's account.
  // INSTAGRAM_ACCOUNT_ID is optional and only used if explicitly provided.
  const node = cfg.instagramAccountId || "me";

  const rawMedia = await graphGetPaged<RawMedia>(
    `${node}/media`,
    { fields: MEDIA_FIELDS, limit },
    cfg,
    IG_BASE
  );

  // Fetch insights with a small concurrency pool to avoid rate spikes.
  const out: OrganicMedia[] = [];
  const pool = 5;
  for (let i = 0; i < rawMedia.length; i += pool) {
    const batch = rawMedia.slice(i, i + pool);
    const settled = await Promise.all(
      batch.map(async (raw) => {
        const candidates =
          classifyContentType(
            raw.media_type ?? null,
            raw.media_product_type ?? null
          ) === "REEL"
            ? REEL_METRICS
            : POST_METRICS;
        const insights = await fetchInsights(raw.id, candidates, cfg);
        return toOrganicMedia(raw, insights);
      })
    );
    out.push(...settled);
  }

  // Newest first.
  out.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

  // Persist a time-stamped snapshot so we can build first-24h/7d comparisons
  // going forward. Non-fatal: never block the dashboard on a write error.
  try {
    await captureSnapshots(out);
  } catch {
    /* ignore snapshot write failures */
  }

  return out;
}

export async function getOrganic(opts?: {
  force?: boolean;
  limit?: number;
}): Promise<OrganicResponse> {
  const limit = opts?.limit ?? 50;
  const key = `organic:${limit}`;
  if (opts?.force) {
    // bypass cache but repopulate it
    const media = await fetchOrganic(limit);
    const res: OrganicResponse = {
      media,
      summary: summariseOrganic(media),
      fetchedAt: new Date().toISOString(),
      cached: false,
    };
    return res;
  }
  const { value, cached } = await withCache(key, () => fetchOrganic(limit));
  return {
    media: value,
    summary: summariseOrganic(value),
    fetchedAt: new Date().toISOString(),
    cached,
  };
}

/** Lightweight connection test for the Settings page. */
export async function testInstagram(): Promise<ConnectionStatus> {
  const cfg = getConfig();
  if (!cfg.token) {
    return {
      ok: false,
      configured: false,
      detail: "Missing META_ACCESS_TOKEN environment variable.",
    };
  }
  const node = cfg.instagramAccountId || "me";
  const json = await graphGet<{
    id?: string;
    user_id?: string;
    username?: string;
  }>(node, { fields: "user_id,username" }, cfg, IG_BASE);
  const id = json.user_id ?? json.id ?? "";
  return {
    ok: true,
    configured: true,
    detail: `Connected to @${json.username ?? id}.`,
    account: { id, username: json.username },
  };
}
