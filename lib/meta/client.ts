// Server-side Meta Graph API client. NEVER import this from a client component.
// The access token lives only in process.env and is never sent to the browser.

import "server-only";
import { MetaApiError } from "./types";

export interface MetaConfig {
  token: string; // Instagram-login token (organic)
  adsToken: string; // Facebook token with ads_read (paid) — falls back to token
  version: string;
  instagramAccountId: string;
  adAccountId: string;
}

export function getConfig(): MetaConfig {
  return {
    token: process.env.META_ACCESS_TOKEN ?? "",
    // The Marketing API needs a Facebook user token; the Instagram-login token
    // can't read ads. Use META_ADS_TOKEN if set, else fall back.
    adsToken: process.env.META_ADS_TOKEN || process.env.META_ACCESS_TOKEN || "",
    version: process.env.META_API_VERSION || "v21.0",
    instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID ?? "",
    adAccountId: normaliseAdAccount(process.env.META_AD_ACCOUNT_ID ?? ""),
  };
}

/** Marketing API expects the account id prefixed with `act_`. */
export function normaliseAdAccount(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("act_") ? trimmed : `act_${trimmed}`;
}

// Facebook Graph host (ads / Marketing API) and Instagram Graph host
// (Instagram-login organic API). Pass `host` to pick one.
export const FB_BASE = "https://graph.facebook.com";
export const IG_BASE = "https://graph.instagram.com";

interface GraphParams {
  [key: string]: string | number | undefined;
}

/** Low-level GET against the Graph API with normalised error handling. */
export async function graphGet<T = any>(
  path: string,
  params: GraphParams,
  cfg: MetaConfig,
  base: string = FB_BASE
): Promise<T> {
  if (!cfg.token) {
    throw new MetaApiError("META_ACCESS_TOKEN is not set.", {
      status: 500,
      endpoint: path,
    });
  }

  const url = new URL(`${base}/${cfg.version}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }
  url.searchParams.set("access_token", cfg.token);

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: "no-store" });
  } catch (e) {
    throw new MetaApiError(
      `Network error contacting Meta: ${(e as Error).message}`,
      { status: 502, endpoint: path }
    );
  }

  const text = await res.text();
  let json: any = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new MetaApiError(`Meta returned a non-JSON response (HTTP ${res.status}).`, {
      status: res.status,
      endpoint: path,
    });
  }

  if (!res.ok || json.error) {
    const err = json.error ?? {};
    throw new MetaApiError(err.message || `Meta API error (HTTP ${res.status}).`, {
      status: res.status,
      metaCode: err.code,
      metaSubcode: err.error_subcode,
      fbtraceId: err.fbtrace_id,
      endpoint: path,
    });
  }

  return json as T;
}

/**
 * Follow Graph API `paging.next` cursors and concatenate `data` arrays.
 * Capped to avoid runaway loops on very large accounts.
 */
export async function graphGetPaged<T = any>(
  path: string,
  params: GraphParams,
  cfg: MetaConfig,
  base: string = FB_BASE,
  maxPages = 25
): Promise<T[]> {
  const out: T[] = [];
  let page = await graphGet<{ data: T[]; paging?: { next?: string; cursors?: any } }>(
    path,
    { ...params, limit: params.limit ?? 50 },
    cfg,
    base
  );
  out.push(...(page.data ?? []));

  let pages = 1;
  while (page.paging?.next && pages < maxPages) {
    // `next` is a fully-formed URL; fetch it directly.
    const res = await fetch(page.paging.next, { cache: "no-store" });
    const json = await res.json();
    if (json.error) {
      throw new MetaApiError(json.error.message || "Meta paging error.", {
        status: res.status,
        metaCode: json.error.code,
        fbtraceId: json.error.fbtrace_id,
        endpoint: path,
      });
    }
    out.push(...(json.data ?? []));
    page = json;
    pages += 1;
  }

  return out;
}
