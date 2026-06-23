"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { OrganicTab } from "@/components/dashboard/organic-tab";
import { PaidTab } from "@/components/dashboard/paid-tab";

export default function DashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
    } catch {
      // ignore — the bump below still forces a re-fetch
    } finally {
      setRefreshKey((k) => k + 1);
      setRefreshing(false);
    }
  }

  return (
    <Tabs defaultValue="organic" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="organic">Organic</TabsTrigger>
          <TabsTrigger value="paid">Paid</TabsTrigger>
        </TabsList>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={refreshing}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh data
        </Button>
      </div>

      <TabsContent value="organic">
        <OrganicTab refreshKey={refreshKey} />
      </TabsContent>
      <TabsContent value="paid">
        <PaidTab refreshKey={refreshKey} />
      </TabsContent>
    </Tabs>
  );
}
