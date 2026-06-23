"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TagManagement() {
  const [catalog, setCatalog] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((j) => setCatalog(j.catalog ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function add() {
    const t = value.trim();
    if (!t) return;
    setValue("");
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogAdd: [t] }),
    });
    const j = await res.json();
    if (j.catalog) setCatalog(j.catalog);
  }

  async function remove(tag: string) {
    setCatalog((c) => c.filter((t) => t !== tag));
    await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ catalogRemove: tag }),
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Content tags</CardTitle>
        <CardDescription>
          Manage the tag list used to label posts (e.g. Product launch,
          Lifestyle, UGC). Tags are stored locally and power tag-performance
          analysis on the Insights page.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="New tag…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="max-w-xs"
          />
          <Button size="sm" variant="outline" onClick={add}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {catalog.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs"
              >
                {t}
                <button
                  onClick={() => remove(t)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${t}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
