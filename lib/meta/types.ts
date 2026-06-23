// Shared types for the Meta / Instagram analytics layer.
// `null` is used deliberately to mean "Meta did not return this metric for
// this object". The UI renders null as "—" / "Not available" and NEVER as 0.

export type Maybe<T> = T | null;

export type ContentType = "REEL" | "POST" | "CAROUSEL";

/** One Instagram media item plus its (best-effort) insight metrics. */
export interface OrganicMedia {
  id: string;
  caption: Maybe<string>;
  permalink: Maybe<string>;
  timestamp: string; // ISO 8601
  mediaType: Maybe<string>; // IMAGE | VIDEO | CAROUSEL_ALBUM
  productType: Maybe<string>; // FEED | REELS | STORY | AD
  contentType: ContentType; // normalised label used by the UI
  thumbnailUrl: Maybe<string>;
  mediaUrl: Maybe<string>;
  // Carousel children, where Meta returns them (used by the lightbox).
  children?: MediaChild[];

  // Raw metrics (null when Meta does not return them for this media type)
  views: Maybe<number>;
  reach: Maybe<number>;
  impressions: Maybe<number>;
  likes: Maybe<number>;
  comments: Maybe<number>;
  shares: Maybe<number>;
  saves: Maybe<number>;
  totalInteractions: Maybe<number>;
  profileVisits: Maybe<number>;
  follows: Maybe<number>;
  avgWatchTime: Maybe<number>; // seconds (ig_reels_avg_watch_time is ms -> converted)
  avgWatchPct: Maybe<number>; // average watch time / video length, if derivable
  skipRate: Maybe<number>;

  // Derived metrics (null when inputs are missing)
  engagement: Maybe<number>;
  engagementRate: Maybe<number>;
  shareRate: Maybe<number>;
  saveRate: Maybe<number>;
  profileVisitRate: Maybe<number>;
  followRate: Maybe<number>;
}

export interface MediaChild {
  id: string;
  mediaType: Maybe<string>;
  mediaUrl: Maybe<string>;
  thumbnailUrl: Maybe<string>;
}

export interface OrganicSummary {
  contentPublished: number;
  reelsPublished: number;
  views: Maybe<number>;
  reach: Maybe<number>;
  engagements: Maybe<number>;
  engagementRate: Maybe<number>;
  shares: Maybe<number>;
  shareRate: Maybe<number>;
  saves: Maybe<number>;
  saveRate: Maybe<number>;
  avgWatchTime: Maybe<number>;
}

export interface OrganicResponse {
  media: OrganicMedia[];
  summary: OrganicSummary;
  fetchedAt: string;
  cached: boolean;
}

/** A point-in-time capture of a media's metrics (time-normalised tracking). */
export interface Snapshot {
  capturedAt: string; // ISO
  ageHours: number; // post age when captured
  views: Maybe<number>;
  reach: Maybe<number>;
  engagement: Maybe<number>;
  engagementRate: Maybe<number>;
  shares: Maybe<number>;
  shareRate: Maybe<number>;
  saves: Maybe<number>;
  saveRate: Maybe<number>;
  profileVisits: Maybe<number>;
  follows: Maybe<number>;
  avgWatchTime: Maybe<number>;
}

/** One ad x placement row from the Marketing API Insights endpoint. */
export interface PaidRow {
  id: string; // synthetic key: adId + placement
  campaignName: Maybe<string>;
  adSetName: Maybe<string>;
  adName: Maybe<string>;
  placement: string; // friendly: "Instagram Feed" etc.
  publisherPlatform: Maybe<string>;
  platformPosition: Maybe<string>;

  spend: Maybe<number>;
  impressions: Maybe<number>;
  reach: Maybe<number>;
  frequency: Maybe<number>;
  clicks: Maybe<number>;
  linkClicks: Maybe<number>;
  ctr: Maybe<number>;
  cpc: Maybe<number>;
  cpm: Maybe<number>;
  videoViews: Maybe<number>;
  engagement: Maybe<number>;
  profileVisits: Maybe<number>;
  websiteClicks: Maybe<number>;
  results: Maybe<number>;
  costPerResult: Maybe<number>;
}

export interface PaidSummary {
  spend: Maybe<number>;
  reach: Maybe<number>;
  impressions: Maybe<number>;
  videoViews: Maybe<number>;
  ctr: Maybe<number>;
  cpc: Maybe<number>;
  cpm: Maybe<number>;
  websiteClicks: Maybe<number>;
  results: Maybe<number>;
  costPerResult: Maybe<number>;
}

export interface PaidResponse {
  rows: PaidRow[];
  summary: PaidSummary;
  fetchedAt: string;
  cached: boolean;
}

export interface ConnectionStatus {
  ok: boolean;
  configured: boolean;
  detail: string;
  account?: { id: string; name?: string; username?: string };
}

/** Normalised error surfaced to the client for the Settings debug panel. */
export class MetaApiError extends Error {
  status: number;
  metaCode?: number;
  metaSubcode?: number;
  fbtraceId?: string;
  endpoint?: string;

  constructor(
    message: string,
    opts: {
      status?: number;
      metaCode?: number;
      metaSubcode?: number;
      fbtraceId?: string;
      endpoint?: string;
    } = {}
  ) {
    super(message);
    this.name = "MetaApiError";
    this.status = opts.status ?? 500;
    this.metaCode = opts.metaCode;
    this.metaSubcode = opts.metaSubcode;
    this.fbtraceId = opts.fbtraceId;
    this.endpoint = opts.endpoint;
  }

  toJSON() {
    return {
      message: this.message,
      status: this.status,
      metaCode: this.metaCode,
      metaSubcode: this.metaSubcode,
      fbtraceId: this.fbtraceId,
      endpoint: this.endpoint,
    };
  }
}
