"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, ExternalLink } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/dashboard/states";
import { fmtDuration, fmtInt, fmtPct, NA } from "@/lib/meta/metrics";
import { enrich, rankBy, type EnrichedMedia } from "@/lib/meta/scoring";
import {
  contentTypeComparison,
  opportunities,
  postingWindows,
  tagPerformance,
} from "@/lib/meta/aggregate";
import type { OrganicResponse } from "@/lib/meta/types";

export default function InsightsPage() {
  const [data, setData] = useState<OrganicResponse | null>(null);
  const [tagsMap, setTagsMap] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch("/api/organic"), fetch("/api/tags")])
      .then(async ([o, t]) => {
        const oj = await o.json();
        if (!o.ok) {
          setError(oj.error?.message ?? "Failed to load");
          return;
        }
        setData(oj);
        const tj = await t.json().catch(() => ({}));
        setTagsMap(tj.tags ?? {});
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const media = useMemo(
    () => (data ? enrich(data.media, tagsMap) : []),
    [data, tagsMap]
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => location.reload()} />;
  if (media.length === 0)
    return <EmptyState message="No content to analyse yet." />;

  const types = contentTypeComparison(media);
  const tags = tagPerformance(media);
  const windows = postingWindows(media);
  const opps = opportunities(media);

  const reels = media.filter((m) => m.group === "REEL");
  const posts = media.filter((m) => m.group !== "REEL");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Content insights</h1>
        <p className="text-sm text-muted-foreground">
          Practical, rule-based summaries from your real Instagram data. Figures
          marked “{NA}” aren&apos;t returned by Meta for that content.
        </p>
      </div>

      {/* E. Opportunities first — most actionable */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Opportunities
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {opps.map((o, i) => (
            <Card key={i}>
              <CardContent className="flex gap-2 p-4">
                {o.tone === "good" ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : o.tone === "watch" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <div className="text-sm font-medium">{o.title}</div>
                  <div className="text-xs text-muted-foreground">{o.detail}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* A. Best content */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Best content
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BestList title="Best Reels by share rate" items={rankBy(reels, (m) => m.shareRate)} metric={(m) => fmtPct(m.shareRate)} />
          <BestList title="Best Reels by save rate" items={rankBy(reels, (m) => m.saveRate)} metric={(m) => fmtPct(m.saveRate)} />
          <BestList title="Best Reels by engagement rate" items={rankBy(reels, (m) => m.engagementRate)} metric={(m) => fmtPct(m.engagementRate)} />
          <BestList title="Best posts by profile visits" items={rankBy(posts, (m) => m.profileVisits)} metric={(m) => fmtInt(m.profileVisits)} />
          <BestList title="Best posts by follows" items={rankBy(posts, (m) => m.follows)} metric={(m) => fmtInt(m.follows)} />
          <BestList title="Best overall content" items={rankBy(media, (m) => m.score)} metric={(m) => (m.score === null ? NA : String(Math.round(m.score)))} />
        </div>
      </section>

      {/* B. Content-type comparison */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Content-type comparison
        </h2>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Posts</TableHead>
                  <TableHead className="text-right">Avg views</TableHead>
                  <TableHead className="text-right">Avg reach</TableHead>
                  <TableHead className="text-right">Avg eng. rate</TableHead>
                  <TableHead className="text-right">Avg share rate</TableHead>
                  <TableHead className="text-right">Avg save rate</TableHead>
                  <TableHead className="text-right">Avg profile visits</TableHead>
                  <TableHead className="text-right">Avg follows</TableHead>
                  <TableHead className="text-right">Avg watch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((r) => (
                  <TableRow key={r.group}>
                    <TableCell className="font-medium">{r.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.avgViews)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.avgReach)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.avgEngagementRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.avgShareRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtPct(r.avgSaveRate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.avgProfileVisits)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(r.avgFollows)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtDuration(r.avgWatchTime)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* C. Tag performance */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Tag performance
        </h2>
        {tags.length === 0 ? (
          <EmptyState message="No tags applied yet. Tag posts from the detail drawer to see which themes perform best." />
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead className="text-right">Posts</TableHead>
                    <TableHead className="text-right">Avg views</TableHead>
                    <TableHead className="text-right">Avg eng. rate</TableHead>
                    <TableHead className="text-right">Avg share rate</TableHead>
                    <TableHead className="text-right">Avg save rate</TableHead>
                    <TableHead className="text-right">Avg profile visits</TableHead>
                    <TableHead className="text-right">Avg follows</TableHead>
                    <TableHead className="text-right">Avg score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tags.map((t) => (
                    <TableRow key={t.tag}>
                      <TableCell className="font-medium">{t.tag}</TableCell>
                      <TableCell className="text-right tabular-nums">{t.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(t.avgViews)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(t.avgEngagementRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(t.avgShareRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(t.avgSaveRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(t.avgProfileVisits)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(t.avgFollows)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t.avgScore === null ? NA : Math.round(t.avgScore)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>

      {/* D. Best posting windows */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Best posting windows
        </h2>
        <Card>
          <CardContent className="space-y-3 p-4 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-muted-foreground">Best day (by avg score)</div>
                <div className="text-lg font-semibold">{windows.bestDay ?? NA}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Best hour (by avg score)</div>
                <div className="text-lg font-semibold">{windows.bestHour ?? NA}</div>
              </div>
            </div>
            {windows.byType.length > 0 ? (
              <div className="border-t pt-3">
                <div className="mb-1 text-xs text-muted-foreground">By content type</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {windows.byType.map((b) => (
                    <div key={b.label} className="flex justify-between rounded-md border px-3 py-1.5">
                      <span>{b.label}</span>
                      <span className="text-muted-foreground">
                        {b.bestDay ?? NA} · {b.bestHour ?? NA}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Based on the local time of each post and its overall score. More
              posts sharpen this signal.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function BestList({
  title,
  items,
  metric,
}: {
  title: string;
  items: EnrichedMedia[];
  metric: (m: EnrichedMedia) => string;
}) {
  const top = items.slice(0, 5);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground">No data.</p>
        ) : (
          top.map((m, i) => (
            <div key={m.id} className="flex items-center gap-2">
              <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
              {m.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.thumbnailUrl} alt="" className="h-9 w-9 rounded object-cover" />
              ) : (
                <div className="h-9 w-9 rounded bg-muted" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={m.caption ?? ""}>
                {m.caption || "(no caption)"}
              </span>
              <span className="text-sm font-medium tabular-nums">{metric(m)}</span>
              {m.permalink ? (
                <a href={m.permalink} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
