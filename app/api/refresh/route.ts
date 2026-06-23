import { NextResponse } from "next/server";
import { clearCache } from "@/lib/meta/cache";

export const dynamic = "force-dynamic";

// Clears the 10-minute in-memory cache so the next dashboard load hits Meta.
export async function POST() {
  clearCache();
  return NextResponse.json({ ok: true, clearedAt: new Date().toISOString() });
}
