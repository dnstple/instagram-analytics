"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OrganicMedia, PaidRow } from "@/lib/meta/types";

const PALETTE = [
  "#6366f1",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
];

function ChartShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {children as any}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function OrganicCharts({ media }: { media: OrganicMedia[] }) {
  // Top 8 by views.
  const top = [...media]
    .filter((m) => m.views !== null)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 8)
    .map((m, i) => ({
      name: shortLabel(m, i),
      views: m.views ?? 0,
      reach: m.reach ?? 0,
    }));

  // Content mix by type.
  const mix = ["REEL", "POST", "CAROUSEL"]
    .map((t) => ({
      name: t === "REEL" ? "Reels" : t === "POST" ? "Posts" : "Carousels",
      value: media.filter((m) => m.contentType === t).length,
    }))
    .filter((d) => d.value > 0);

  if (media.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartShell title="Top posts by views">
        <BarChart data={top} margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="name" fontSize={11} />
          <YAxis fontSize={11} width={48} />
          <Tooltip />
          <Legend />
          <Bar dataKey="views" name="Views" fill={PALETTE[0]} radius={[4, 4, 0, 0]} />
          <Bar dataKey="reach" name="Reach" fill={PALETTE[2]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartShell>

      <ChartShell title="Content mix">
        <PieChart>
          <Pie
            data={mix}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {mix.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ChartShell>
    </div>
  );
}

export function PaidCharts({ rows }: { rows: PaidRow[] }) {
  // Spend by placement.
  const byPlacement = aggregate(rows, (r) => r.placement, (r) => r.spend ?? 0);

  // Top campaigns by spend.
  const byCampaign = aggregate(
    rows,
    (r) => r.campaignName ?? "(unnamed)",
    (r) => r.spend ?? 0
  )
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartShell title="Spend by placement">
        <PieChart>
          <Pie
            data={byPlacement}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
          >
            {byPlacement.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
          <Legend />
        </PieChart>
      </ChartShell>

      <ChartShell title="Top campaigns by spend">
        <BarChart data={byCampaign} margin={{ left: 8, right: 8, top: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
          <XAxis dataKey="name" fontSize={11} hide />
          <YAxis fontSize={11} width={48} />
          <Tooltip formatter={(v: any) => `$${Number(v).toFixed(2)}`} />
          <Bar dataKey="value" name="Spend" fill={PALETTE[1]} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ChartShell>
    </div>
  );
}

function aggregate<T>(
  rows: T[],
  key: (r: T) => string,
  val: (r: T) => number
): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    map.set(k, (map.get(k) ?? 0) + val(r));
  }
  return Array.from(map, ([name, value]) => ({ name, value }));
}

function shortLabel(m: OrganicMedia, i: number): string {
  const c = (m.caption ?? "").trim();
  if (c) return c.slice(0, 14) + (c.length > 14 ? "…" : "");
  return `#${i + 1}`;
}
