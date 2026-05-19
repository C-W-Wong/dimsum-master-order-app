import { NextResponse } from "next/server";
import { parseMenu, type MenuImage } from "@/lib/parseMenu";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Claude vision can take 15-40s on a complex menu; give it room.
export const maxDuration = 60;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

type Body = {
  images?: { data?: string; mediaType?: string }[];
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const raw = body.images ?? [];
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json(
      { error: "at least one image is required" },
      { status: 400 }
    );
  }
  if (raw.length > 6) {
    return NextResponse.json(
      { error: "at most 6 images per parse" },
      { status: 400 }
    );
  }

  const images: MenuImage[] = [];
  for (const [i, img] of raw.entries()) {
    if (!img.data || !img.mediaType || !ALLOWED_TYPES.has(img.mediaType)) {
      return NextResponse.json(
        { error: `image ${i + 1}: missing data or unsupported mediaType` },
        { status: 400 }
      );
    }
    images.push({
      data: img.data,
      mediaType: img.mediaType as MenuImage["mediaType"],
    });
  }

  try {
    const result = await parseMenu(images);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "parse failed";
    // Surface the message to the client — these are short and user-facing
    // (e.g. "Claude did not call submit_menu — try clearer photos").
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
