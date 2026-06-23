// File-based persistence (no database, per the MVP constraint). Stores manual
// content tags and metric snapshots as JSON under ./.data. Server-only.

import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { OrganicMedia, Snapshot } from "./types";

// On serverless hosts (e.g. Vercel) the project directory is read-only, but the
// system temp dir is writable. Use it there. NOTE: temp storage is ephemeral —
// tags/snapshots persist within a running instance but reset on redeploy/cold
// start. Swap this for a managed store (KV/Postgres) for durable persistence.
const DATA_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), "ig-analytics-data")
  : path.join(process.cwd(), ".data");
const TAGS_FILE = path.join(DATA_DIR, "tags.json");
const CATALOG_FILE = path.join(DATA_DIR, "tag-catalog.json");
const SNAPSHOTS_FILE = path.join(DATA_DIR, "snapshots.json");

const DEFAULT_TAGS = [
  "Product launch",
  "Lifestyle",
  "Editorial",
  "Behind the scenes",
  "Campaign",
  "Founder / personality",
  "Outfit",
  "Product close-up",
  "Studio shoot",
  "Location",
  "Sale",
  "UGC",
  "Seasonal",
  "Trend-based",
  "Paid creative",
];

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await ensureDir();
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

// ---- Tags (per media) ----
export type TagsMap = Record<string, string[]>;

export async function readTags(): Promise<TagsMap> {
  return readJson<TagsMap>(TAGS_FILE, {});
}

export async function setTagsFor(mediaId: string, tags: string[]) {
  const map = await readTags();
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean)));
  if (clean.length === 0) delete map[mediaId];
  else map[mediaId] = clean;
  await writeJson(TAGS_FILE, map);
  // Make sure any new tags exist in the catalog too.
  if (clean.length) await addToCatalog(clean);
  return map[mediaId] ?? [];
}

// ---- Tag catalog (manageable in Settings) ----
export async function readCatalog(): Promise<string[]> {
  const stored = await readJson<string[] | null>(CATALOG_FILE, null);
  if (stored && stored.length) return stored;
  return DEFAULT_TAGS;
}

export async function addToCatalog(tags: string[]) {
  const current = await readCatalog();
  const merged = Array.from(new Set([...current, ...tags]));
  await writeJson(CATALOG_FILE, merged);
  return merged;
}

export async function removeFromCatalog(tag: string) {
  const current = await readCatalog();
  const next = current.filter((t) => t !== tag);
  await writeJson(CATALOG_FILE, next);
  return next;
}

// ---- Snapshots (time-normalised performance) ----
export type SnapshotMap = Record<string, Snapshot[]>;

const MAX_SNAPSHOTS_PER_MEDIA = 80;

export async function readSnapshots(): Promise<SnapshotMap> {
  return readJson<SnapshotMap>(SNAPSHOTS_FILE, {});
}

/**
 * Append a snapshot for each media if metrics meaningfully changed or enough
 * time passed since the last capture. Keeps history bounded.
 */
export async function captureSnapshots(media: OrganicMedia[]): Promise<void> {
  if (media.length === 0) return;
  const map = await readSnapshots();
  const now = Date.now();

  for (const m of media) {
    const ageHours = (now - new Date(m.timestamp).getTime()) / 3_600_000;
    const list = map[m.id] ?? [];
    const last = list[list.length - 1];
    // De-dupe: skip if last capture was <1h ago AND views unchanged.
    if (last) {
      const sinceH = (now - new Date(last.capturedAt).getTime()) / 3_600_000;
      if (sinceH < 1 && last.views === (m.views ?? null)) continue;
    }
    list.push({
      capturedAt: new Date(now).toISOString(),
      ageHours,
      views: m.views ?? null,
      reach: m.reach ?? null,
      engagement: m.engagement ?? null,
      engagementRate: m.engagementRate ?? null,
      shares: m.shares ?? null,
      shareRate: m.shareRate ?? null,
      saves: m.saves ?? null,
      saveRate: m.saveRate ?? null,
      profileVisits: m.profileVisits ?? null,
      follows: m.follows ?? null,
      avgWatchTime: m.avgWatchTime ?? null,
    });
    map[m.id] = list.slice(-MAX_SNAPSHOTS_PER_MEDIA);
  }

  await writeJson(SNAPSHOTS_FILE, map);
}
