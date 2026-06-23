"use client";

import { Trophy } from "lucide-react";
import { RANK_SPECS } from "@/lib/meta/scoring";

export function BestPerformers({
  activeKey,
  onSelect,
}: {
  activeKey: string | null;
  onSelect: (key: string | null) => void;
}) {
  const active = RANK_SPECS.find((r) => r.key === activeKey) ?? null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <Trophy className="h-4 w-4" />
        Best performers
      </div>
      <div className="flex flex-wrap gap-2">
        {RANK_SPECS.map((spec) => {
          const on = spec.key === activeKey;
          return (
            <button
              key={spec.key}
              onClick={() => onSelect(on ? null : spec.key)}
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
      {active ? (
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{active.label}:</span>{" "}
          {active.explanation}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          Click a ranking to instantly sort and highlight the table. Click again
          to clear.
        </p>
      )}
    </div>
  );
}
