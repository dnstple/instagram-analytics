"use client";

import { useState } from "react";
import { Tag as TagIcon, ChevronDown } from "lucide-react";

export function TagFilter({
  catalog,
  selected,
  onChange,
}: {
  catalog: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  if (catalog.length === 0) return <div />;

  const toggle = (t: string) =>
    onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
      >
        <TagIcon className="h-4 w-4" />
        {selected.length > 0 ? `Tags: ${selected.length}` : "Filter by tag"}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 max-h-72 w-64 overflow-y-auto rounded-md border bg-card p-2 shadow-md">
            <div className="flex flex-wrap gap-1.5">
              {catalog.map((t) => {
                const on = selected.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => toggle(t)}
                    className={`rounded-full border px-2.5 py-0.5 text-xs ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {selected.length > 0 ? (
              <button
                onClick={() => onChange([])}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Clear tag filter
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
