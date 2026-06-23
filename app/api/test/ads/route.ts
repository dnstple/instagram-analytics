import { NextResponse } from "next/server";
import { testAds } from "@/lib/meta/ads";
import { MetaApiError } from "@/lib/meta/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await testAds();
    return NextResponse.json(status);
  } catch (e) {
    const err =
      e instanceof MetaApiError
        ? e.toJSON()
        : { message: (e as Error).message, status: 500 };
    return NextResponse.json(
      { ok: false, configured: true, detail: err.message, error: err },
      { status: err.status ?? 500 }
    );
  }
}
