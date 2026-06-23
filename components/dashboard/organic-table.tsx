"use client";

import { useMemo } from "react";
import {
  ColumnDef,
  SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/info-tip";
import { fmtDate, fmtDuration, fmtInt, fmtPct, NA } from "@/lib/meta/metrics";
import { percentileLabel, ratioLabel, type EnrichedMedia } from "@/lib/meta/scoring";

export interface OrganicColumnToggles {
  score: boolean;
  percentile: boolean;
  vsViews: boolean;
  vsEngagement: boolean;
  vsShare: boolean;
  vsSave: boolean;
}

function typeVariant(t: string): "default" | "secondary" | "outline" {
  if (t === "REEL") return "default";
  if (t === "CAROUSEL") return "secondary";
  return "outline";
}
function typeLabel(t: string): string {
  if (t === "REEL") return "Reel";
  if (t === "CAROUSEL") return "Carousel";
  return "Post";
}

export function OrganicTable({
  data,
  sorting,
  onSortingChange,
  toggles,
  highlightColumn,
  onRowClick,
  onThumbClick,
}: {
  data: EnrichedMedia[];
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  toggles: OrganicColumnToggles;
  highlightColumn?: string;
  onRowClick: (m: EnrichedMedia) => void;
  onThumbClick: (m: EnrichedMedia) => void;
}) {
  const columns = useMemo<ColumnDef<EnrichedMedia>[]>(() => {
    const cols: ColumnDef<EnrichedMedia>[] = [
      {
        id: "thumbnail",
        header: "Media",
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onThumbClick(m);
              }}
              className="group relative h-12 w-12 overflow-hidden rounded bg-muted"
              title="Preview"
            >
              {m.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={m.thumbnailUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  {NA}
                </span>
              )}
              <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-[10px] font-medium text-white group-hover:flex">
                Preview
              </span>
            </button>
          );
        },
      },
      {
        id: "type",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant={typeVariant(row.original.contentType)}>
            {typeLabel(row.original.contentType)}
          </Badge>
        ),
      },
      {
        id: "timestamp",
        accessorFn: (m) => new Date(m.timestamp).getTime(),
        header: "Posted",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{fmtDate(row.original.timestamp)}</span>
        ),
      },
      {
        id: "caption",
        header: "Caption",
        enableSorting: false,
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="max-w-[240px]">
              <span
                className="block truncate text-muted-foreground"
                title={m.caption ?? ""}
              >
                {m.caption || NA}
              </span>
              {m.tags.length > 0 ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.tags.slice(0, 3).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
                    >
                      {t}
                    </span>
                  ))}
                  {m.tags.length > 3 ? (
                    <span className="text-[10px] text-muted-foreground">
                      +{m.tags.length - 3}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        },
      },
      numCol("views", "Views", (m) => m.views),
      numCol("reach", "Reach", (m) => m.reach),
      numCol("impressions", "Impressions", (m) => m.impressions),
      numCol("likes", "Likes", (m) => m.likes),
      numCol("comments", "Comments", (m) => m.comments),
      numCol("shares", "Shares", (m) => m.shares),
      pctCol("shareRate", "Share rate", (m) => m.shareRate),
      numCol("saves", "Saves", (m) => m.saves),
      pctCol("saveRate", "Save rate", (m) => m.saveRate),
      numCol("engagement", "Engagements", (m) => m.engagement),
      pctCol("engagementRate", "Eng. rate", (m) => m.engagementRate),
      numCol("profileVisits", "Profile visits", (m) => m.profileVisits),
      numCol("follows", "Follows", (m) => m.follows),
      durCol("avgWatchTime", "Avg watch", (m) => m.avgWatchTime),
      pctCol("skipRate", "Skip rate", (m) => m.skipRate),
    ];

    if (toggles.score)
      cols.push({
        id: "score",
        accessorFn: (m) => m.score ?? undefined,
        sortUndefined: "last",
        header: () => (
          <HeaderLabel>
            Score
            <InfoTip text="Overall score (0-100): weighted percentile blend vs comparable content — 30% engagement rate, 25% share rate, 20% save rate, 15% profile-visit rate, 10% follow rate." />
          </HeaderLabel>
        ),
        cell: ({ row }) => (
          <div className="text-right font-medium tabular-nums">
            {row.original.score === null ? NA : Math.round(row.original.score)}
          </div>
        ),
      });
    if (toggles.percentile)
      cols.push({
        id: "scorePercentile",
        accessorFn: (m) => m.scorePercentile ?? undefined,
        sortUndefined: "last",
        header: () => <HeaderLabel>Percentile</HeaderLabel>,
        cell: ({ row }) => (
          <div className="text-right text-xs">
            {percentileLabel(row.original.scorePercentile)}
          </div>
        ),
      });
    if (toggles.vsViews) cols.push(vsCol("views", "Views vs avg"));
    if (toggles.vsEngagement) cols.push(vsCol("engagementRate", "Eng. vs avg"));
    if (toggles.vsShare) cols.push(vsCol("shareRate", "Share vs avg"));
    if (toggles.vsSave) cols.push(vsCol("saveRate", "Save vs avg"));

    cols.push({
      id: "permalink",
      header: "Link",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.permalink ? (
          <Button
            asChild
            size="sm"
            variant="outline"
            onClick={(e) => e.stopPropagation()}
          >
            <a href={row.original.permalink} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <span className="text-muted-foreground">{NA}</span>
        ),
    });

    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggles, onThumbClick]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    sortDescFirst: true,
    enableSortingRemoval: false,
  });

  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => {
                const sortable = h.column.getCanSort();
                const dir = h.column.getIsSorted();
                const active = highlightColumn === h.column.id;
                return (
                  <TableHead
                    key={h.id}
                    className={active ? "bg-primary/10" : undefined}
                  >
                    {sortable ? (
                      <button
                        className="inline-flex items-center gap-1 hover:text-foreground"
                        onClick={h.column.getToggleSortingHandler()}
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {dir === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : dir === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(h.column.columnDef.header, h.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => onRowClick(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={
                    highlightColumn === cell.column.id ? "bg-primary/5" : undefined
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function HeaderLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex w-full items-center justify-end gap-1 text-right">
      {children}
    </span>
  );
}

// ---- Column factories (right-aligned, null-aware sorting) ----
function numCol(
  id: string,
  header: string,
  pick: (m: EnrichedMedia) => number | null
): ColumnDef<EnrichedMedia> {
  return {
    id,
    accessorFn: (m) => pick(m) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{fmtInt(pick(row.original))}</div>
    ),
  };
}

function pctCol(
  id: string,
  header: string,
  pick: (m: EnrichedMedia) => number | null
): ColumnDef<EnrichedMedia> {
  return {
    id,
    accessorFn: (m) => pick(m) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{fmtPct(pick(row.original))}</div>
    ),
  };
}

function durCol(
  id: string,
  header: string,
  pick: (m: EnrichedMedia) => number | null
): ColumnDef<EnrichedMedia> {
  return {
    id,
    accessorFn: (m) => pick(m) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">
        {fmtDuration(pick(row.original))}
      </div>
    ),
  };
}

function vsCol(
  benchKey: "views" | "engagementRate" | "shareRate" | "saveRate",
  header: string
): ColumnDef<EnrichedMedia> {
  return {
    id: `vs_${benchKey}`,
    accessorFn: (m) => m.benchmarks[benchKey].ratio ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right text-xs text-muted-foreground">
        {ratioLabel(row.original.benchmarks[benchKey].ratio)}
      </div>
    ),
  };
}
