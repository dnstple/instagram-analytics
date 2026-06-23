import { NextResponse } from "next/server";
import { readSnapshots } from "@/lib/meta/store";

export const dynamic = "force-dynamic";

// GET -> { snapshots: { [mediaId]: Snapshot[] } }
export async function GET() {
  const snapshots = await readSnapshots();
  return NextResponse.json({ snapshots });
}
