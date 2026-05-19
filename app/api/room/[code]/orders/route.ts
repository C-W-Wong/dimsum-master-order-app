import { NextResponse } from "next/server";
import { isValidCode, newId, updateRoom } from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddBody = {
  itemId?: string;
  userId?: string;
  qty?: number;
  note?: string;
};

/**
 * Add a new order entry. Each call creates a separate entry — intentional, so
 * the UI can render "Alex (×2), Bob (×1)" instead of collapsing contributors.
 */
export async function POST(
  req: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as AddBody;
  const { itemId, userId } = body;
  const qty = Math.max(1, Math.min(99, Math.floor(body.qty ?? 1)));
  if (!itemId || !userId) {
    return NextResponse.json(
      { error: "itemId and userId required" },
      { status: 400 }
    );
  }

  const updated = await updateRoom(code, (room) => {
    const me = room.participants.find((p) => p.id === userId);
    if (!me) throw new Error("not-in-room");
    if (!room.menu.items.some((i) => i.id === itemId)) {
      throw new Error("unknown-item");
    }
    room.orders.push({
      id: newId("o_"),
      itemId,
      qty,
      userId: me.id,
      userName: me.name,
      note: body.note?.toString().slice(0, 120),
      createdAt: Date.now(),
    });
  }).catch((err: Error) => {
    if (err.message === "not-in-room") return "not-in-room" as const;
    if (err.message === "unknown-item") return "unknown-item" as const;
    throw err;
  });

  if (updated === "not-in-room") {
    return NextResponse.json(
      { error: "you are not a member of this room" },
      { status: 403 }
    );
  }
  if (updated === "unknown-item") {
    return NextResponse.json({ error: "unknown item" }, { status: 400 });
  }
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ room: updated });
}
