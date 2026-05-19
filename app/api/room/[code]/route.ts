import { NextResponse } from "next/server";
import {
  isValidCode,
  newId,
  pickHue,
  readRoom,
  updateRoom,
} from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const room = await readRoom(code);
  if (!room) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ room });
}

type JoinBody = {
  userName?: string;
  /** If supplied and still present in the room, we reuse it (rejoin). */
  userId?: string;
};

/**
 * Join an existing room. Idempotent — if the same userId+name is already in
 * the room, just returns the current state.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as JoinBody;
  const userName = (body.userName ?? "").toString().trim().slice(0, 24);
  if (!userName) {
    return NextResponse.json(
      { error: "userName is required" },
      { status: 400 }
    );
  }

  let assignedUserId = body.userId ?? null;

  const updated = await updateRoom(code, (room) => {
    if (assignedUserId) {
      const existing = room.participants.find((p) => p.id === assignedUserId);
      if (existing) {
        existing.name = userName; // allow rename on rejoin
        return;
      }
    }
    const userId = newId("u_");
    assignedUserId = userId;
    room.participants.push({
      id: userId,
      name: userName,
      hue: pickHue(room.participants),
      joinedAt: Date.now(),
    });
  });

  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ room: updated, you: { userId: assignedUserId } });
}
