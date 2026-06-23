import { NextRequest, NextResponse } from "next/server";
import {
  readTags,
  setTagsFor,
  readCatalog,
  addToCatalog,
  removeFromCatalog,
} from "@/lib/meta/store";

export const dynamic = "force-dynamic";

// GET -> { tags: { [mediaId]: string[] }, catalog: string[] }
export async function GET() {
  const [tags, catalog] = await Promise.all([readTags(), readCatalog()]);
  return NextResponse.json({ tags, catalog });
}

// POST body:
//  { mediaId, tags: string[] }      -> set tags for a media
//  { catalogAdd: string[] }         -> add tags to the catalog
//  { catalogRemove: string }        -> remove a tag from the catalog
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    if (typeof body.mediaId === "string" && Array.isArray(body.tags)) {
      const tags = await setTagsFor(body.mediaId, body.tags);
      return NextResponse.json({ ok: true, mediaId: body.mediaId, tags });
    }
    if (Array.isArray(body.catalogAdd)) {
      const catalog = await addToCatalog(body.catalogAdd);
      return NextResponse.json({ ok: true, catalog });
    }
    if (typeof body.catalogRemove === "string") {
      const catalog = await removeFromCatalog(body.catalogRemove);
      return NextResponse.json({ ok: true, catalog });
    }
    return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}
