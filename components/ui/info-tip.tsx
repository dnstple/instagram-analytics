"use client";

import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/** Tiny dependency-free tooltip: an info dot that reveals text on hover/focus. */
export function InfoTip({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("group relative inline-flex align-middle", className)}>
      <Info
        className="h-3.5 w-3.5 cursor-help text-muted-foreground/70"
        tabIndex={0}
        aria-label={text}
      />
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1 w-56 -translate-x-1/2 rounded-md border bg-popover bg-card p-2 text-xs font-normal leading-snug text-card-foreground opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
