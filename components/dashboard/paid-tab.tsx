"use client";

import { useEffect, useMemo, useState } from "react";
import type { SortingState } from "@tanstack/react-table";
import { Trophy } from "lucide-react";
import { KpiCard, KpiGrid } from "./kpi-card";
import { EmptyState, ErrorState, LoadingState } from "./states";
import { PaidTable } from "./paid-table";
import { PaidCharts } from "./charts";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtInt, fmtMoney, fmtPct, safeRate, safeSum } from "@/lib/meta/metrics";
import type { PaidResponse, PaidRow, PaidSummary } from "@/lib/meta/types";

interface FetchError {
  message: string;
  detail?: string;
}

const DATE_PRESETS = [
  { value: "last_7d", label: "Last 7 days" },
  { value: "last_14d", label: "Last 14 days" },
  { value: "last_30d", label: "Last 30 days" },
  { value: "last_90d", label: "Last 90 days" },
  { value: "maximum", label: "Maximum" },
];

const PLACEMENTS = [
  "All",
  "Instagram Feed",
  "Instagram Reels",
  "Instagram Stories",
  "Instagram Explore",
];

const PAID_RANKS: {
  key: string;
  label: string;
  col: string;
  desc: boolean;
}[] = [
  { key: "low_cpr", label: "Lowest cost / result", col: "costPerResult", desc: false },
  { key: "high_ctr", label: "Highest CTR", col: "ctr", desc: true },
  { key: "most_web", label: "Most website clicks", col: "websiteClicks", desc: true },
  { key: "most_visits", label: "Most profile visits", col: "profileVisits", desc: true },
  { key: "most_vv", label: "Most video views", col: "videoViews", desc: true },
  { key: "most_eng", label: "Most engagement", col: "engagement", desc: true },
];

function summarise(rows: PaidRow[]): PaidSummary {
  const spend = safeSum(rows.map((r) => r.spend));
  const impressions = safeSum(rows.map((r) => r.impressions));
  const clicks = safeSum(rows.map((r) => r.clicks));
  return {
    spend,
    reach: safeSum(rows.map((r) => r.reach)),
    impressions,
    videoViews: safeSum(rows.map((r) => r.videoViews)),
    ctr: safeRate(clicks, impressions),
    cpc: safeRate(spend, clicks),
    cpm:
      spend === null || impressions === null || impressions === 0
        ? null
        : (spend / impressions) * 1000,
    websiteClicks: safeSum(rows.map((r) => r.websiteClicks)),
    results: safeSum(rows.map((r) => r.results)),
    costPerResult: null,
  };
}

export function PaidTab({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<PaidResponse | null>(null);
  const [error, setError] = useState<FetchError | null>(null);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("last_30d");
  const [placement, setPlacement] = useState("All");
  const [campaign, setCampaign] = useState("All");
  const [adSet, setAdSet] = useState("All");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "spend", desc: true },
  ]);
  const [activeRank, setActiveRank] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ datePreset });
      if (force) params.set("force", "1");
      const res = await fetch(`/api/paid?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError({
          message: json.error?.message ?? "Request failed.",
          detail: json.error?.fbtraceId
            ? `Meta code ${json.error.metaCode ?? "?"} · trace ${json.error.fbtraceId}`
            : undefined,
        });
        setData(null);
      } else {
        setData(json);
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
  }, [refreshKey, datePreset]);

  const campaigns = useMemo(() => {
    const set = new Set<string>();
    data?.rows.forEach((r) => r.campaignName && set.add(r.campaignName));
    return ["All", ...Array.from(set).sort()];
  }, [data]);

  const adSets = useMemo(() => {
    const set = new Set<string>();
    data?.rows
      .filter((r) => campaign === "All" || r.campaignName === campaign)
      .forEach((r) => r.adSetName && set.add(r.adSetName));
    return ["All", ...Array.from(set).sort()];
  }, [data, campaign]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.filter(
      (r) =>
        (placement === "All" || r.placement === placement) &&
        (campaign === "All" || r.campaignName === campaign) &&
        (adSet === "All" || r.adSetName === adSet)
    );
  }, [data, placement, campaign, adSet]);

  const summary = useMemo(() => summarise(rows), [rows]);

  function applyRank(key: string) {
    const spec = PAID_RANKS.find((r) => r.key === key);
    if (!spec) return;
    if (activeRank === key) {
      setActiveRank(null);
      return;
    }
    setActiveRank(key);
    setSorting([{ id: spec.col, desc: spec.desc }]);
  }
  const highlightColumn = activeRank
    ? PAID_RANKS.find((r) => r.key === activeRank)?.col
    : undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Date range">
          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Instagram placement">
          <Select value={placement} onValueChange={setPlacement}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLACEMENTS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Campaign">
          <Select
            value={campaign}
            onValueChange={(v) => {
              setCampaign(v);
              setAdSet("All");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Ad set">
          <Select value={adSet} onValueChange={setAdSet}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {adSets.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {loading ? (
        <LoadingState />
      ) : error && /META_AD_ACCOUNT_ID/.test(error.message) ? (
        <EmptyState message="Paid ad reporting isn't enabled yet. It needs a Facebook access token with ads_read plus META_AD_ACCOUNT_ID set in .env.local. The Organic tab works without it." />
      ) : error ? (
        <ErrorState message={error.message} detail={error.detail} onRetry={() => load(true)} />
      ) : !data || data.rows.length === 0 ? (
        <EmptyState message="No Instagram ad data for this period. Check the ad account ID, or widen the date range." />
      ) : (
        <>
          <KpiGrid>
            <KpiCard label="Spend" value={fmtMoney(summary.spend)} />
            <KpiCard label="Reach" value={fmtInt(summary.reach)} />
            <KpiCard label="Impressions" value={fmtInt(summary.impressions)} />
            <KpiCard label="Video views" value={fmtInt(summary.videoViews)} />
            <KpiCard label="CTR" value={fmtPct(summary.ctr)} />
            <KpiCard label="CPC" value={fmtMoney(summary.cpc)} />
            <KpiCard label="CPM" value={fmtMoney(summary.cpm)} />
            <KpiCard label="Website clicks" value={fmtInt(summary.websiteClicks)} />
            <KpiCard label="Results" value={fmtInt(summary.results)} />
            <KpiCard label="Cost per result" value={fmtMoney(summary.costPerResult)} />
          </KpiGrid>

          {/* Best paid ads quick ranks */}
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium">
              <Trophy className="h-4 w-4" /> Best paid ads
            </div>
            <div className="flex flex-wrap gap-2">
              {PAID_RANKS.map((spec) => {
                const on = spec.key === activeRank;
                return (
                  <button
                    key={spec.key}
                    onClick={() => applyRank(spec.key)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {spec.label}
                  </button>
                );
              })}
            </div>
          </div>

          <PaidCharts rows={rows} />

          <div className="text-sm text-muted-foreground">
            Showing {rows.length} ad × placement rows. Click any column header to
            sort.
          </div>

          {rows.length === 0 ? (
            <EmptyState message="No rows for these filters." />
          ) : (
            <PaidTable
              data={rows}
              sorting={sorting}
              onSortingChange={(s) => {
                setSorting(s);
                setActiveRank(null);
              }}
              highlightColumn={highlightColumn}
            />
          )}
        </>
      )}
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
