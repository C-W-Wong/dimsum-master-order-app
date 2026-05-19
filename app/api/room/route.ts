import { NextResponse } from "next/server";
import type { ParsedMenu } from "@/lib/menu";
import {
  generateRoomCode,
  newId,
  newRoom,
  pickHue,
  readRoom,
  writeRoom,
} from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  userName?: string;
  menu?: ParsedMenu;
};

function isValidMenu(menu: unknown): menu is ParsedMenu {
  if (!menu || typeof menu !== "object") return false;
  const m = menu as Partial<ParsedMenu>;
  if (!m.restaurant || typeof m.restaurant !== "object") return false;
  if (!Array.isArray(m.categories) || m.categories.length === 0) return false;
  if (!Array.isArray(m.items) || m.items.length === 0) return false;
  // Every item must point at a real category.
  const catIds = new Set(m.categories.map((c) => c.id));
  return m.items.every((i) => i && typeof i.id === "string" && catIds.has(i.category));
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const userName = (body.userName ?? "").toString().trim().slice(0, 24);
  if (!userName) {
    return NextResponse.json(
      { error: "userName is required" },
      { status: 400 }
    );
  }
  if (!isValidMenu(body.menu)) {
    return NextResponse.json(
      { error: "valid menu is required (parse one via /api/parse-menu first)" },
      { status: 400 }
    );
  }

  let code = "";
  for (let i = 0; i < 8; i++) {
    const candidate = generateRoomCode(4);
    const existing = await readRoom(candidate);
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) code = generateRoomCode(6); // very rare fallback

  const room = newRoom(code, body.menu);
  const userId = newId("u_");
  room.participants.push({
    id: userId,
    name: userName,
    hue: pickHue(room.participants),
    joinedAt: Date.now(),
  });
  await writeRoom(room);

  return NextResponse.json({ room, you: { userId } });
}
