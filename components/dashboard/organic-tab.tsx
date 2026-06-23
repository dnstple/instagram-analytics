"use client";

import { useEffect, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { KpiCard, KpiGrid } from "./kpi-card";
import { EmptyState, ErrorState, LoadingState } from "./states";
import {
  OrganicFilters,
  applyOrganicFilters,
  defaultOrganicFilters,
  type OrganicFilterState,
  type OrganicSortKey,
} from "./organic-filters";
import { OrganicTable, type OrganicColumnToggles } from "./organic-table";
import { OrganicCharts } from "./charts";
import { BestPerformers } from "./best-performers";
import { MediaLightbox } from "./media-lightbox";
import { PostDrawer } from "./post-drawer";
import { TagFilter } from "./tag-filter";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fmtDuration,
  fmtInt,
  fmtPct,
  summariseOrganic,
} from "@/lib/meta/metrics";
import { enrich, rankBy, RANK_SPECS, type EnrichedMedia } from "@/lib/meta/scoring";
import { PERIODS, periodLabel, resolvePeriod, type PeriodKey } from "@/lib/meta/period";
import type { OrganicMedia, OrganicResponse, Snapshot } from "@/lib/meta/types";

interface FetchError {
  message: string;
  detail?: string;
}

const SORT_KEY_COLUMNS: Record<OrganicSortKey, string> = {
  timestamp: "timestamp",
  views: "views",
  reach: "reach",
  engagement: "engagement",
  engagementRate: "engagementRate",
  shares: "shares",
  saves: "saves",
};
const COLUMN_TO_SORT_KEY: Record<string, OrganicSortKey> = Object.fromEntries(
  Object.entries(SORT_KEY_COLUMNS).map(([k, v]) => [v, k as OrganicSortKey])
) as Record<string, OrganicSortKey>;

const DEFAULT_TOGGLES: OrganicColumnToggles = {
  score: true,
  percentile: false,
  vsViews: false,
  vsEngagement: false,
  vsShare: false,
  vsSave: false,
};

export function OrganicTab({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<OrganicResponse | null>(null);
  const [error, setError] = useState<FetchError | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<OrganicFilterState>(defaultOrganicFilters);
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});
  const [catalog, setCatalog] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Snapshot[]>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "timestamp", desc: true },
  ]);
  const [activeRank, setActiveRank] = useState<string | null>(null);
  const [toggles, setToggles] = useState<OrganicColumnToggles>(DEFAULT_TOGGLES);
  const [period, setPeriod] = useState<PeriodKey>("lifetime");

  // Lightbox + drawer
  const [lightbox, setLightbox] = useState<OrganicMedia | null>(null);
  const [drawer, setDrawer] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const [orgRes, tagRes, snapRes] = await Promise.all([
        fetch(`/api/organic${force ? "?force=1" : ""}`),
        fetch("/api/tags"),
        fetch("/api/snapshots"),
      ]);
      const orgJson = await orgRes.json();
      if (!orgRes.ok) {
        setError({
          message: orgJson.error?.message ?? "Request failed.",
          detail: orgJson.error?.fbtraceId
            ? `Meta code ${orgJson.error.metaCode ?? "?"} · trace ${orgJson.error.fbtraceId}`
            : undefined,
        });
        setData(null);
      } else {
        setData(orgJson);
        const tagJson = await tagRes.json().catch(() => ({}));
        setTagsMap(tagJson.tags ?? {});
        setCatalog(tagJson.catalog ?? []);
        const snapJson = await snapRes.json().catch(() => ({}));
        setSnapshots(snapJson.snapshots ?? {});
      }
    } catch (e) {
      setError({ message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(refreshKey > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Enrich with benchmarks + score + tags, against the whole comparable set.
  const enriched = useMemo(
    () => (data ? enrich(data.media, tagsMap) : []),
    [data, tagsMap]
  );

  // Apply filters (content type, dates, min views/er, search) + tag filter.
  const filtered = useMemo(() => {
    let list = applyOrganicFilters(enriched, filters) as EnrichedMedia[];
    if (selectedTags.length > 0)
      list = list.filter((m) => selectedTags.every((t) => m.tags.includes(t)));
    const spec = RANK_SPECS.find((r) => r.key === activeRank);
    if (spec) {
      if (spec.onlyGroup) list = list.filter((m) => m.group === spec.onlyGroup);
      if (spec.filter) list = list.filter(spec.filter);
      list = rankBy(list, spec.value, spec.sortDesc === false ? "asc" : "desc");
    }
    return list;
  }, [enriched, filters, selectedTags, activeRank]);

  const summary = useMemo(() => summariseOrganic(filtered), [filtered]);

  // Period-adjusted summary from snapshots (honest: only posts with history).
  const periodView = useMemo(() => {
    if (period === "lifetime")
      return { summary, covered: filtered.length, total: filtered.length };
    const now = Date.now();
    const periodMedia: OrganicMedia[] = [];
    for (const m of filtered) {
      const r = resolvePeriod(snapshots[m.id], period, m.timestamp, now);
      if (r.status === "ok" && r.snapshot) {
        periodMedia.push({
          ...m,
          views: r.snapshot.views,
          reach: r.snapshot.reach,
          engagement: r.snapshot.engagement,
          shares: r.snapshot.shares,
          saves: r.snapshot.saves,
          avgWatchTime: r.snapshot.avgWatchTime,
        });
      }
    }
    return {
      summary: summariseOrganic(periodMedia),
      covered: periodMedia.length,
      total: filtered.length,
    };
  }, [period, snapshots, filtered, summary]);

  // ---- Sorting sync (table <-> Sort by / Direction selects) ----
  function applyRank(key: string | null) {
    setActiveRank(key);
    const spec = RANK_SPECS.find((r) => r.key === key);
    if (spec) {
      // The score column must be visible for the table to sort by it.
      if (spec.sortColumn === "score" && !toggles.score)
        setToggles((t) => ({ ...t, score: true }));
      setSorting([{ id: spec.sortColumn, desc: spec.sortDesc !== false }]);
    }
  }
  function onSortingChange(next: SortingState) {
    setSorting(next);
    setActiveRank(null);
    const top = next[0];
    if (top && COLUMN_TO_SORT_KEY[top.id]) {
      setFilters((f) => ({
        ...f,
        sortBy: COLUMN_TO_SORT_KEY[top.id],
        sortDir: top.desc ? "desc" : "asc",
      }));
    }
  }
  // When the Sort by / Direction selects change, drive the table.
  useEffect(() => {
    const col = SORT_KEY_COLUMNS[filters.sortBy];
    setSorting((cur) => {
      const top = cur[0];
      if (top && top.id === col && top.desc === (filters.sortDir === "desc"))
        return cur;
      return [{ id: col, desc: filters.sortDir === "desc" }];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.sortBy, filters.sortDir]);

  const highlightColumn = activeRank
    ? RANK_SPECS.find((r) => r.key === activeRank)?.sortColumn
    : undefined;

  async function saveTags(mediaId: string, tags: string[]) {
    setTagsMap((m) => ({ ...m, [mediaId]: tags }));
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaId, tags }),
      });
      const json = await res.json();
      if (json.catalog) setCatalog(json.catalog);
    } catch {
      /* optimistic update already applied */
    }
  }

  if (loading) return <LoadingState />;
  if (error)
    return (
      <ErrorState message={error.message} detail={error.detail} onRetry={() => load(true)} />
    );
  if (!data || data.media.length === 0)
    return (
      <EmptyState message="No Instagram media returned. Check the account and token, or post some content." />
    );

  const drawerMedia = drawer ? filtered.find((m) => m.id === drawer) ?? null : null;
  const ps = periodView.summary;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label>Comparison period</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.key} value={p.key}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {period !== "lifetime" ? (
          <p className="max-w-md text-xs text-muted-foreground">
            {periodView.covered} of {periodView.total} posts have snapshot
            history for the {periodLabel(period).toLowerCase()} window. Posts
            without early snapshots are excluded here and shown as “Lifetime
            only”. Snapshot history grows as the dashboard refreshes over time.
          </p>
        ) : null}
      </div>

      {/* KPI cards (reflect comparison period) */}
      <div>
        <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {periodLabel(period)} · KPIs
        </div>
        <KpiGrid>
          <KpiCard label="Content published" value={fmtInt(summary.contentPublished)} />
          <KpiCard label="Reels published" value={fmtInt(summary.reelsPublished)} />
          <KpiCard label="Views" value={fmtInt(ps.views)} />
          <KpiCard label="Reach" value={fmtInt(ps.reach)} />
          <KpiCard label="Engagements" value={fmtInt(ps.engagements)} />
          <KpiCard label="Engagement rate" value={fmtPct(ps.engagementRate)} />
          <KpiCard label="Shares" value={fmtInt(ps.shares)} />
          <KpiCard label="Share rate" value={fmtPct(ps.shareRate)} />
          <KpiCard label="Saves" value={fmtInt(ps.saves)} />
          <KpiCard label="Save rate" value={fmtPct(ps.saveRate)} />
          <KpiCard label="Avg watch time" value={fmtDuration(ps.avgWatchTime)} hint="Reels only" />
        </KpiGrid>
      </div>

      <BestPerformers activeKey={activeRank} onSelect={applyRank} />

      <OrganicFilters value={filters} onChange={setFilters} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TagFilter
          catalog={catalog}
          selected={selectedTags}
          onChange={setSelectedTags}
        />
        <ColumnToggles toggles={toggles} onChange={setToggles} />
      </div>

      <OrganicCharts media={filtered} />

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} of {data.media.length} media items.
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No media matches the current filters." />
      ) : (
        <OrganicTable
          data={filtered}
          sorting={sorting}
          onSortingChange={onSortingChange}
          toggles={toggles}
          highlightColumn={highlightColumn}
          onRowClick={(m) => setDrawer(m.id)}
          onThumbClick={(m) => setLightbox(m)}
        />
      )}

      <MediaLightbox media={lightbox} onClose={() => setLightbox(null)} />
      <PostDrawer
        media={drawerMedia}
        snapshots={drawerMedia ? snapshots[drawerMedia.id] : undefined}
        catalog={catalog}
        onClose={() => setDrawer(null)}
        onOpenLightbox={(m) => setLightbox(m)}
        onTagsChange={saveTags}
      />
    </div>
  );
}

function ColumnToggles({
  toggles,
  onChange,
}: {
  toggles: OrganicColumnToggles;
  onChange: (t: OrganicColumnToggles) => void;
}) {
  const items: { key: keyof OrganicColumnToggles; label: string }[] = [
    { key: "score", label: "Score" },
    { key: "percentile", label: "Percentile" },
    { key: "vsViews", label: "Views vs avg" },
    { key: "vsEngagement", label: "Eng vs avg" },
    { key: "vsShare", label: "Share vs avg" },
    { key: "vsSave", label: "Save vs avg" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Columns:</span>
      {items.map((it) => {
        const on = toggles[it.key];
        return (
          <button
            key={it.key}
            onClick={() => onChange({ ...toggles, [it.key]: !on })}
            className={`rounded-full border px-2.5 py-0.5 ${
              on ? "border-primary bg-primary/10" : "hover:bg-accent"
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
