// Paid Meta Ads data via the Marketing API Insights endpoint.
// Ad-level rows broken down by placement, filtered to Instagram by default.

import "server-only";
import { graphGetPaged, graphGet, getConfig, type MetaConfig } from "./client";
import { withCache } from "./cache";
import { safeRate, safeSum } from "./metrics";
import type {
  ConnectionStatus,
  Maybe,
  PaidResponse,
  PaidRow,
  PaidSummary,
} from "./types";
import { MetaApiError } from "./types";

const INSIGHT_FIELDS = [
  "campaign_name",
  "adset_name",
  "ad_name",
  "ad_id",
  "spend",
  "impressions",
  "reach",
  "frequency",
  "clicks",
  "inline_link_clicks",
  "ctr",
  "cpc",
  "cpm",
  "actions",
  "video_play_actions",
  "outbound_clicks",
].join(",");

interface ActionEntry {
  action_type: string;
  value: string;
}

interface RawInsightRow {
  campaign_name?: string;
  adset_name?: string;
  ad_name?: string;
  ad_id?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  frequency?: string;
  clicks?: string;
  inline_link_clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: ActionEntry[];
  video_play_actions?: ActionEntry[];
  outbound_clicks?: ActionEntry[];
  publisher_platform?: string;
  platform_position?: string;
}

function num(v: string | undefined): Maybe<number> {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function actionValue(
  actions: ActionEntry[] | undefined,
  types: string[]
): Maybe<number> {
  if (!actions) return null;
  const matches = actions.filter((a) => types.includes(a.action_type));
  if (matches.length === 0) return null;
  return matches.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
}

const PLACEMENT_LABELS: Record<string, string> = {
  feed: "Instagram Feed",
  instagram_profile_feed: "Instagram Profile Feed",
  story: "Instagram Stories",
  instagram_stories: "Instagram Stories",
  reels: "Instagram Reels",
  instagram_reels: "Instagram Reels",
  instagram_reels_overlay: "Instagram Reels",
  explore: "Instagram Explore",
  instagram_explore: "Instagram Explore",
  instagram_explore_home: "Instagram Explore",
  instagram_search: "Instagram Search",
  ig_search: "Instagram Search",
};

function labelPlacement(position?: string): string {
  if (!position) return "Instagram (unspecified)";
  const known = PLACEMENT_LABELS[position];
  if (known) return known;
  // Title-case unknown positions for readability.
  return (
    "Instagram " +
    position
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function toPaidRow(raw: RawInsightRow): PaidRow {
  const videoViews = actionValue(raw.video_play_actions, [
    "video_view",
  ]) ?? actionValue(raw.actions, ["video_view"]);
  const engagement = actionValue(raw.actions, [
    "post_engagement",
    "page_engagement",
  ]);
  const websiteClicks =
    actionValue(raw.outbound_clicks, ["outbound_click"]) ??
    actionValue(raw.actions, ["link_click"]);

  return {
    id: `${raw.ad_id ?? raw.ad_name ?? "ad"}:${raw.platform_position ?? "na"}`,
    campaignName: raw.campaign_name ?? null,
    adSetName: raw.adset_name ?? null,
    adName: raw.ad_name ?? null,
    placement: labelPlacement(raw.platform_position),
    publisherPlatform: raw.publisher_platform ?? null,
    platformPosition: raw.platform_position ?? null,
    spend: num(raw.spend),
    impressions: num(raw.impressions),
    reach: num(raw.reach),
    frequency: num(raw.frequency),
    clicks: num(raw.clicks),
    linkClicks: num(raw.inline_link_clicks),
    ctr: num(raw.ctr) === null ? null : (num(raw.ctr) as number) / 100, // Meta ctr is a percentage
    cpc: num(raw.cpc),
    cpm: num(raw.cpm),
    videoViews,
    engagement,
    // Profile visits & results/cost-per-result are not exposed at this level
    // by the Insights API in a reliable, objective-agnostic way -> null ("—").
    profileVisits: null,
    websiteClicks,
    results: null,
    costPerResult: null,
  };
}

function summarisePaid(rows: PaidRow[]): PaidSummary {
  const spend = safeSum(rows.map((r) => r.spend));
  const impressions = safeSum(rows.map((r) => r.impressions));
  const reach = safeSum(rows.map((r) => r.reach));
  const clicks = safeSum(rows.map((r) => r.clicks));
  const websiteClicks = safeSum(rows.map((r) => r.websiteClicks));
  const videoViews = safeSum(rows.map((r) => r.videoViews));

  return {
    spend,
    reach,
    impressions,
    videoViews,
    // Recompute blended rates from totals rather than averaging per-row rates.
    ctr: safeRate(clicks, impressions),
    cpc: safeRate(spend, clicks),
    cpm:
      spend === null || impressions === null || impressions === 0
        ? null
        : (spend / impressions) * 1000,
    websiteClicks,
    results: safeSum(rows.map((r) => r.results)),
    costPerResult: null,
  };
}

async function fetchPaid(opts: {
  datePreset?: string;
  instagramOnly?: boolean;
}): Promise<PaidRow[]> {
  const cfg = getConfig();
  if (!cfg.adAccountId) {
    throw new MetaApiError("META_AD_ACCOUNT_ID is not set.", { status: 500 });
  }
  // Marketing API runs on the Facebook Graph host with the ads token.
  const adCfg = { ...cfg, token: cfg.adsToken };

  const rows = await graphGetPaged<RawInsightRow>(
    `${cfg.adAccountId}/insights`,
    {
      level: "ad",
      fields: INSIGHT_FIELDS,
      breakdowns: "publisher_platform,platform_position",
      date_preset: opts.datePreset ?? "last_30d",
      limit: 100,
    },
    adCfg
  );

  const mapped = rows
    .filter((r) =>
      opts.instagramOnly === false
        ? true
        : r.publisher_platform === "instagram"
    )
    .map(toPaidRow);

  // Highest spend first.
  mapped.sort((a, b) => (b.spend ?? 0) - (a.spend ?? 0));
  return mapped;
}

export async function getPaid(opts?: {
  force?: boolean;
  datePreset?: string;
  instagramOnly?: boolean;
}): Promise<PaidResponse> {
  const datePreset = opts?.datePreset ?? "last_30d";
  const instagramOnly = opts?.instagramOnly ?? true;
  const key = `paid:${datePreset}:${instagramOnly}`;

  const build = (rows: PaidRow[], cached: boolean): PaidResponse => ({
    rows,
    summary: summarisePaid(rows),
    fetchedAt: new Date().toISOString(),
    cached,
  });

  if (opts?.force) {
    const rows = await fetchPaid({ datePreset, instagramOnly });
    return build(rows, false);
  }
  const { value, cached } = await withCache(key, () =>
    fetchPaid({ datePreset, instagramOnly })
  );
  return build(value, cached);
}

/** Lightweight ad-account connection test for the Settings page. */
export async function testAds(): Promise<ConnectionStatus> {
  const cfg = getConfig();
  if (!cfg.adsToken || !cfg.adAccountId) {
    return {
      ok: false,
      configured: false,
      detail:
        "Paid needs a Facebook token (META_ADS_TOKEN) with ads_read and META_AD_ACCOUNT_ID set.",
    };
  }
  const adCfg = { ...cfg, token: cfg.adsToken };
  const json = await graphGet<{
    id: string;
    name?: string;
    account_status?: number;
  }>(cfg.adAccountId, { fields: "id,name,account_status" }, adCfg);
  return {
    ok: true,
    configured: true,
    detail: `Connected to ad account ${json.name ?? json.id}.`,
    account: { id: json.id, name: json.name },
  };
}
