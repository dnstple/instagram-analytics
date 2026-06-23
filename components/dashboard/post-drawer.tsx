"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CheckCircle2,
  AlertTriangle,
  Info as InfoIcon,
  ExternalLink,
  Plus,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import {
  fmtDate,
  fmtDuration,
  fmtInt,
  fmtPct,
  NA,
} from "@/lib/meta/metrics";
import {
  BENCH_GROUP_LABEL,
  percentileLabel,
  postInsights,
  ratioLabel,
  type BenchKey,
  type EnrichedMedia,
} from "@/lib/meta/scoring";
import type { Snapshot } from "@/lib/meta/types";

function typeLabel(m: EnrichedMedia): string {
  if (m.contentType === "REEL") return "Reel";
  if (m.contentType === "CAROUSEL") return "Carousel";
  if (m.mediaType === "VIDEO") return "Video";
  return "Post";
}

export function PostDrawer({
  media,
  snapshots,
  catalog,
  onClose,
  onOpenLightbox,
  onTagsChange,
}: {
  media: EnrichedMedia | null;
  snapshots?: Snapshot[];
  catalog: string[];
  onClose: () => void;
  onOpenLightbox: (m: EnrichedMedia) => void;
  onTagsChange: (mediaId: string, tags: string[]) => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (media) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media, onClose]);

  if (!media) return null;

  const insights = postInsights(media);
  const composition = [
    { name: "Likes", value: media.likes ?? 0 },
    { name: "Comments", value: media.comments ?? 0 },
    { name: "Shares", value: media.shares ?? 0 },
    { name: "Saves", value: media.saves ?? 0 },
  ].filter(() => media.engagement !== null);

  const trend = (snapshots ?? [])
    .filter((s) => s.views !== null || s.reach !== null)
    .map((s) => ({
      age: Math.round(s.ageHours),
      views: s.views ?? null,
      reach: s.reach ?? null,
    }));

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/40" onClick={onClose}>
      <aside
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b p-4">
          <button
            onClick={() => onOpenLightbox(media)}
            className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted"
            title="Preview"
          >
            {media.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={media.thumbnailUrl}
                alt=""
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                {NA}
              </span>
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant={media.contentType === "REEL" ? "default" : "secondary"}>
                {typeLabel(media)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {fmtDate(media.timestamp)}
              </span>
            </div>
            <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
              {media.caption || NA}
            </p>
            {media.permalink ? (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <a href={media.permalink} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Open on Instagram
                </a>
              </Button>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close (Esc)">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-4">
          {/* Overall score */}
          <section className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm font-medium">
                Overall score
                <InfoTip text="Weighted percentile blend vs comparable content: 30% engagement rate, 25% share rate, 20% save rate, 15% profile-visit rate, 10% follow rate. Weights renormalise when a metric is unavailable." />
              </span>
              <span className="text-2xl font-semibold tabular-nums">
                {media.score === null ? NA : Math.round(media.score)}
              </span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {percentileLabel(media.scorePercentile)} among{" "}
              {BENCH_GROUP_LABEL[media.group]}
            </div>
          </section>

          {/* Insight cards */}
          <section className="space-y-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-md border p-2 text-sm"
              >
                {ins.tone === "good" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : ins.tone === "watch" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span>{ins.text}</span>
              </div>
            ))}
          </section>

          {/* Benchmarks */}
          <section>
            <h3 className="mb-2 text-sm font-medium">
              Versus your average {BENCH_GROUP_LABEL[media.group].toLowerCase()}
            </h3>
            <div className="space-y-1.5">
              {(
                [
                  ["engagementRate", "Engagement rate"],
                  ["shareRate", "Share rate"],
                  ["saveRate", "Save rate"],
                  ["profileVisitRate", "Profile-visit rate"],
                  ["followRate", "Follow rate"],
                  ["views", "Views"],
                ] as [BenchKey, string][]
              ).map(([key, label]) => {
                const bm = media.benchmarks[key];
                const isRate = key.endsWith("Rate");
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="text-muted-foreground">{label}</span>
                    <span className="flex items-center gap-2 text-right">
                      <span className="tabular-nums">
                        {bm.value === null
                          ? NA
                          : isRate
                          ? fmtPct(bm.value)
                          : fmtInt(bm.value)}
                      </span>
                      <span className="w-32 text-xs text-muted-foreground">
                        {ratioLabel(bm.ratio)}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Performance grid */}
          <section>
            <h3 className="mb-2 text-sm font-medium">Performance</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <Stat label="Views" value={fmtInt(media.views)} />
              <Stat label="Reach" value={fmtInt(media.reach)} />
              <Stat label="Impressions" value={fmtInt(media.impressions)} />
              <Stat label="Likes" value={fmtInt(media.likes)} />
              <Stat label="Comments" value={fmtInt(media.comments)} />
              <Stat label="Shares" value={fmtInt(media.shares)} />
              <Stat label="Saves" value={fmtInt(media.saves)} />
              <Stat label="Profile visits" value={fmtInt(media.profileVisits)} />
              <Stat label="Follows" value={fmtInt(media.follows)} />
              <Stat
                label="Engagement rate"
                value={fmtPct(media.engagementRate)}
                calc
              />
              <Stat label="Share rate" value={fmtPct(media.shareRate)} calc />
              <Stat label="Save rate" value={fmtPct(media.saveRate)} calc />
              <Stat label="Avg watch time" value={fmtDuration(media.avgWatchTime)} />
              <Stat label="Avg watch %" value={fmtPct(media.avgWatchPct)} />
              <Stat label="Skip rate" value={fmtPct(media.skipRate)} />
              <Stat
                label="Performance pct"
                value={percentileLabel(media.performancePercentile)}
                calc
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Italic ⃰ values are calculated from Meta data. Others are returned
              by Meta directly. “{NA}” means Meta did not return that metric.
            </p>
          </section>

          {/* Engagement composition */}
          {composition.length > 0 ? (
            <section>
              <h3 className="mb-2 text-sm font-medium">Engagement composition</h3>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={composition} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="name" fontSize={11} />
                    <YAxis fontSize={11} width={40} />
                    <RTooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          ) : null}

          {/* Views/reach trend (snapshots) */}
          <section>
            <h3 className="mb-2 flex items-center gap-1 text-sm font-medium">
              Views / reach trend
              <InfoTip text="Built from stored snapshots captured each time the dashboard refreshes. New posts accumulate history over time; older posts may show no trend yet." />
            </h3>
            {trend.length > 1 ? (
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis
                      dataKey="age"
                      fontSize={11}
                      unit="h"
                      label={{ value: "post age", position: "insideBottom", fontSize: 10, dy: 10 }}
                    />
                    <YAxis fontSize={11} width={40} />
                    <RTooltip />
                    <Line type="monotone" dataKey="views" stroke="#6366f1" dot={false} />
                    <Line type="monotone" dataKey="reach" stroke="#14b8a6" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Not enough snapshots yet. Trend will appear as the dashboard
                captures more data points over the coming days.
              </p>
            )}
          </section>

          {/* Tags */}
          <section>
            <h3 className="mb-2 text-sm font-medium">Content tags</h3>
            <TagEditor
              current={media.tags}
              catalog={catalog}
              onChange={(tags) => onTagsChange(media.id, tags)}
            />
          </section>
        </div>
      </aside>
    </div>
  );
}

function Stat({
  label,
  value,
  calc,
}: {
  label: string;
  value: string;
  calc?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-dashed py-0.5">
      <span className="text-muted-foreground">
        {label}
        {calc ? <span title="Calculated from Meta data"> ⃰</span> : null}
      </span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function TagEditor({
  current,
  catalog,
  onChange,
}: {
  current: string[];
  catalog: string[];
  onChange: (tags: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const available = catalog.filter((t) => !current.includes(t));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {current.length === 0 ? (
          <span className="text-xs text-muted-foreground">No tags yet.</span>
        ) : (
          current.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
            >
              {t}
              <button
                onClick={() => onChange(current.filter((x) => x !== t))}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${t}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {adding ? (
        <div className="flex flex-wrap gap-1.5 rounded-md border p-2">
          {available.map((t) => (
            <button
              key={t}
              onClick={() => {
                onChange([...current, t]);
                setAdding(false);
              }}
              className="rounded-full border px-2.5 py-0.5 text-xs hover:bg-accent"
            >
              {t}
            </button>
          ))}
          <button
            onClick={() => setAdding(false)}
            className="rounded-full px-2 py-0.5 text-xs text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <Plus className="h-3.5 w-3.5" /> Add tag
        </Button>
      )}
    </div>
  );
}
