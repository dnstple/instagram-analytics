"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type OrganicSortKey =
  | "timestamp"
  | "views"
  | "reach"
  | "engagement"
  | "engagementRate"
  | "shares"
  | "saves";

export interface OrganicFilterState {
  contentType: "ALL" | "REEL" | "POST" | "CAROUSEL";
  dateFrom: string;
  dateTo: string;
  minViews: string;
  minEngagementRate: string; // percent, e.g. "2.5"
  sortBy: OrganicSortKey;
  sortDir: "asc" | "desc";
  search: string;
}

export const defaultOrganicFilters: OrganicFilterState = {
  contentType: "ALL",
  dateFrom: "",
  dateTo: "",
  minViews: "",
  minEngagementRate: "",
  sortBy: "timestamp",
  sortDir: "desc",
  search: "",
};

export function OrganicFilters({
  value,
  onChange,
}: {
  value: OrganicFilterState;
  onChange: (next: OrganicFilterState) => void;
}) {
  const set = <K extends keyof OrganicFilterState>(
    key: K,
    v: OrganicFilterState[K]
  ) => onChange({ ...value, [key]: v });

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Field label="Content type">
        <Select
          value={value.contentType}
          onValueChange={(v) =>
            set("contentType", v as OrganicFilterState["contentType"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All</SelectItem>
            <SelectItem value="REEL">Reels</SelectItem>
            <SelectItem value="POST">Posts</SelectItem>
            <SelectItem value="CAROUSEL">Carousels</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Posted from">
        <Input
          type="date"
          value={value.dateFrom}
          onChange={(e) => set("dateFrom", e.target.value)}
        />
      </Field>

      <Field label="Posted to">
        <Input
          type="date"
          value={value.dateTo}
          onChange={(e) => set("dateTo", e.target.value)}
        />
      </Field>

      <Field label="Search caption">
        <Input
          placeholder="Contains text…"
          value={value.search}
          onChange={(e) => set("search", e.target.value)}
        />
      </Field>

      <Field label="Minimum views">
        <Input
          type="number"
          min={0}
          placeholder="0"
          value={value.minViews}
          onChange={(e) => set("minViews", e.target.value)}
        />
      </Field>

      <Field label="Min engagement rate (%)">
        <Input
          type="number"
          min={0}
          step="0.1"
          placeholder="0"
          value={value.minEngagementRate}
          onChange={(e) => set("minEngagementRate", e.target.value)}
        />
      </Field>

      <Field label="Sort by">
        <Select
          value={value.sortBy}
          onValueChange={(v) => set("sortBy", v as OrganicSortKey)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="timestamp">Posted date</SelectItem>
            <SelectItem value="views">Views</SelectItem>
            <SelectItem value="reach">Reach</SelectItem>
            <SelectItem value="engagement">Engagement</SelectItem>
            <SelectItem value="engagementRate">Engagement rate</SelectItem>
            <SelectItem value="shares">Shares</SelectItem>
            <SelectItem value="saves">Saves</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label="Direction">
        <Select
          value={value.sortDir}
          onValueChange={(v) => set("sortDir", v as "asc" | "desc")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Descending</SelectItem>
            <SelectItem value="asc">Ascending</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

/** Apply filters + sort to a media list (pure, used by the organic tab). */
export function applyOrganicFilters<
  T extends {
    contentType: string;
    timestamp: string;
    caption: string | null;
    views: number | null;
    reach: number | null;
    engagement: number | null;
    engagementRate: number | null;
    shares: number | null;
    saves: number | null;
  }
>(media: T[], f: OrganicFilterState): T[] {
  const minViews = f.minViews === "" ? null : Number(f.minViews);
  const minEr =
    f.minEngagementRate === "" ? null : Number(f.minEngagementRate) / 100;
  const from = f.dateFrom ? new Date(f.dateFrom).getTime() : null;
  const to = f.dateTo ? new Date(f.dateTo).getTime() + 86_400_000 : null;
  const q = f.search.trim().toLowerCase();

  const filtered = media.filter((m) => {
    if (f.contentType !== "ALL" && m.contentType !== f.contentType) return false;
    const t = new Date(m.timestamp).getTime();
    if (from !== null && t < from) return false;
    if (to !== null && t >= to) return false;
    if (minViews !== null && (m.views ?? 0) < minViews) return false;
    if (minEr !== null && (m.engagementRate ?? 0) < minEr) return false;
    if (q && !(m.caption ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  const dir = f.sortDir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    if (f.sortBy === "timestamp") {
      return (
        dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      );
    }
    const av = (a[f.sortBy] as number | null) ?? -Infinity;
    const bv = (b[f.sortBy] as number | null) ?? -Infinity;
    return dir * (av - bv);
  });

  return filtered;
}
