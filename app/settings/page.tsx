"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
  Instagram,
  Megaphone,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TagManagement } from "@/components/dashboard/tag-management";

interface TestResult {
  ok: boolean;
  configured: boolean;
  detail: string;
  error?: {
    message: string;
    metaCode?: number;
    metaSubcode?: number;
    fbtraceId?: string;
    endpoint?: string;
  };
}

export default function SettingsPage() {
  const [igState, setIg] = useState<{ loading: boolean; result?: TestResult }>({
    loading: false,
  });
  const [adState, setAd] = useState<{ loading: boolean; result?: TestResult }>({
    loading: false,
  });
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  async function test(
    path: string,
    setter: typeof setIg
  ) {
    setter({ loading: true });
    try {
      const res = await fetch(path);
      const json = (await res.json()) as TestResult;
      setter({ loading: false, result: json });
    } catch (e) {
      setter({
        loading: false,
        result: {
          ok: false,
          configured: true,
          detail: (e as Error).message,
          error: { message: (e as Error).message },
        },
      });
    }
  }

  async function refresh() {
    setRefreshMsg("Clearing cache…");
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const json = await res.json();
      setRefreshMsg(
        json.ok
          ? `Cache cleared at ${new Date(json.clearedAt).toLocaleTimeString()}. Reopen the dashboard to pull fresh data.`
          : "Failed to clear cache."
      );
    } catch (e) {
      setRefreshMsg((e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Connection status and debugging for the Meta API. The access token is
          stored server-side and never sent to the browser.
        </p>
      </div>

      <ConnectionCard
        title="Instagram connection"
        description="Instagram Graph API · organic media & insights"
        icon={<Instagram className="h-5 w-5" />}
        loading={igState.loading}
        result={igState.result}
        onTest={() => test("/api/test/instagram", setIg)}
      />

      <ConnectionCard
        title="Meta ad account connection"
        description="Marketing API · paid Instagram placements"
        icon={<Megaphone className="h-5 w-5" />}
        loading={adState.loading}
        result={adState.result}
        onTest={() => test("/api/test/ads", setAd)}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data</CardTitle>
          <CardDescription>
            The dashboard caches Meta responses for 10 minutes. Refresh to clear
            the cache and force a fresh pull.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh data
          </Button>
          {refreshMsg ? (
            <p className="text-sm text-muted-foreground">{refreshMsg}</p>
          ) : null}
        </CardContent>
      </Card>

      <TagManagement />
    </div>
  );
}

function ConnectionCard({
  title,
  description,
  icon,
  loading,
  result,
  onTest,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  loading: boolean;
  result?: TestResult;
  onTest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <StatusBadge loading={loading} result={result} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" size="sm" onClick={onTest} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Test connection
        </Button>

        {result ? (
          <div className="space-y-1 text-sm">
            <p
              className={
                result.ok ? "text-foreground" : "text-destructive"
              }
            >
              {result.detail}
            </p>
            {result.error ? (
              <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs text-muted-foreground">
                {JSON.stringify(result.error, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function StatusBadge({
  loading,
  result,
}: {
  loading: boolean;
  result?: TestResult;
}) {
  if (loading)
    return (
      <Badge variant="secondary">
        <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Testing
      </Badge>
    );
  if (!result) return <Badge variant="outline">Not tested</Badge>;
  if (!result.configured)
    return <Badge variant="outline">Not configured</Badge>;
  return result.ok ? (
    <Badge className="bg-emerald-600 hover:bg-emerald-600">
      <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
    </Badge>
  ) : (
    <Badge variant="destructive">
      <XCircle className="mr-1 h-3 w-3" /> Error
    </Badge>
  );
}
