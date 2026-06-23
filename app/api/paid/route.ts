import { NextRequest, NextResponse } from "next/server";
import { getPaid } from "@/lib/meta/ads";
import { MetaApiError } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";
  const datePreset = searchParams.get("datePreset") || "last_30d";
  // Instagram-only by default; pass instagramOnly=0 to include all placements.
  const instagramOnly = searchParams.get("instagramOnly") !== "0";

  try {
    const data = await getPaid({ force, datePreset, instagramOnly });
    return NextResponse.json(data);
  } catch (e) {
    const err =
      e instanceof MetaApiError
        ? e.toJSON()
        : { message: (e as Error).message, status: 500 };
    return NextResponse.json({ error: err }, { status: err.status ?? 500 });
  }
}
