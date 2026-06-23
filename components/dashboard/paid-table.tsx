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
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtInt, fmtMoney, fmtPct, NA } from "@/lib/meta/metrics";
import type { PaidRow } from "@/lib/meta/types";

export function PaidTable({
  data,
  sorting,
  onSortingChange,
  highlightColumn,
}: {
  data: PaidRow[];
  sorting: SortingState;
  onSortingChange: (s: SortingState) => void;
  highlightColumn?: string;
}) {
  const columns = useMemo<ColumnDef<PaidRow>[]>(
    () => [
      text("campaign", "Campaign", (r) => r.campaignName, "max-w-[180px]"),
      text("adset", "Ad set", (r) => r.adSetName, "max-w-[160px]"),
      text("ad", "Ad", (r) => r.adName, "max-w-[160px]"),
      {
        id: "placement",
        header: "Placement",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge variant="secondary" className="whitespace-nowrap">
            {row.original.placement}
          </Badge>
        ),
      },
      money("spend", "Spend", (r) => r.spend),
      num("impressions", "Impressions", (r) => r.impressions),
      num("reach", "Reach", (r) => r.reach),
      dec("frequency", "Frequency", (r) => r.frequency),
      num("videoViews", "Video views", (r) => r.videoViews),
      num("clicks", "Clicks", (r) => r.clicks),
      pct("ctr", "CTR", (r) => r.ctr),
      money("cpc", "CPC", (r) => r.cpc),
      money("cpm", "CPM", (r) => r.cpm),
      num("engagement", "Engagement", (r) => r.engagement),
      num("profileVisits", "Profile visits", (r) => r.profileVisits),
      num("websiteClicks", "Website clicks", (r) => r.websiteClicks),
      num("results", "Results", (r) => r.results),
      money("costPerResult", "Cost / result", (r) => r.costPerResult),
    ],
    []
  );

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
                  <TableHead key={h.id} className={active ? "bg-primary/10" : undefined}>
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
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  className={highlightColumn === cell.column.id ? "bg-primary/5" : undefined}
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

function text(
  id: string,
  header: string,
  pick: (r: PaidRow) => string | null,
  width = ""
): ColumnDef<PaidRow> {
  return {
    id,
    accessorFn: (r) => pick(r) ?? "",
    header,
    cell: ({ row }) => {
      const v = pick(row.original);
      return (
        <span className={`block truncate ${width}`} title={v ?? ""}>
          {v || NA}
        </span>
      );
    },
  };
}

function num(
  id: string,
  header: string,
  pick: (r: PaidRow) => number | null
): ColumnDef<PaidRow> {
  return {
    id,
    accessorFn: (r) => pick(r) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{fmtInt(pick(row.original))}</div>
    ),
  };
}

function dec(
  id: string,
  header: string,
  pick: (r: PaidRow) => number | null
): ColumnDef<PaidRow> {
  return {
    id,
    accessorFn: (r) => pick(r) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => {
      const v = pick(row.original);
      return (
        <div className="text-right tabular-nums">{v === null ? NA : v.toFixed(2)}</div>
      );
    },
  };
}

function pct(
  id: string,
  header: string,
  pick: (r: PaidRow) => number | null
): ColumnDef<PaidRow> {
  return {
    id,
    accessorFn: (r) => pick(r) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{fmtPct(pick(row.original))}</div>
    ),
  };
}

function money(
  id: string,
  header: string,
  pick: (r: PaidRow) => number | null
): ColumnDef<PaidRow> {
  return {
    id,
    accessorFn: (r) => pick(r) ?? undefined,
    sortUndefined: "last",
    header: () => <div className="w-full text-right">{header}</div>,
    cell: ({ row }) => (
      <div className="text-right tabular-nums">{fmtMoney(pick(row.original))}</div>
    ),
  };
}
