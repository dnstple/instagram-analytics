import { NextRequest, NextResponse } from "next/server";
import { getOrganic } from "@/lib/meta/instagram";
import { MetaApiError } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const force = searchParams.get("force") === "1";
  const limit = Number(searchParams.get("limit")) || 50;

  try {
    const data = await getOrganic({ force, limit });
    return NextResponse.json(data);
  } catch (e) {
    const err =
      e instanceof MetaApiError
        ? e.toJSON()
        : { message: (e as Error).message, status: 500 };
    return NextResponse.json({ error: err }, { status: err.status ?? 500 });
  }
}
