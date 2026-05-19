import { NextResponse } from "next/server";
import { isValidCode, updateRoom } from "@/lib/room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PatchBody = {
  userId?: string;
  qty?: number;
};

/** Adjust qty on an entry. Only the user who created it may change it. */
export async function PATCH(
  req: Request,
  { params }: { params: { code: string; orderId: string } }
) {
  const { code, orderId } = params;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const userId = body.userId;
  const qty = Math.max(0, Math.min(99, Math.floor(body.qty ?? 0)));
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const updated = await updateRoom(code, (room) => {
    const idx = room.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error("no-order");
    if (room.orders[idx].userId !== userId) throw new Error("forbidden");
    if (qty === 0) {
      room.orders.splice(idx, 1);
    } else {
      room.orders[idx].qty = qty;
    }
  }).catch((err: Error) => {
    if (err.message === "no-order") return "no-order" as const;
    if (err.message === "forbidden") return "forbidden" as const;
    throw err;
  });

  if (updated === "no-order") {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (updated === "forbidden") {
    return NextResponse.json(
      { error: "you can only adjust your own entries" },
      { status: 403 }
    );
  }
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ room: updated });
}

/** Remove an entry. Only the user who created it may delete it. */
export async function DELETE(
  req: Request,
  { params }: { params: { code: string; orderId: string } }
) {
  const { code, orderId } = params;
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "invalid code" }, { status: 400 });
  }
  const url = new URL(req.url);
  const userId = url.searchParams.get("userId") ?? "";
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const updated = await updateRoom(code, (room) => {
    const idx = room.orders.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error("no-order");
    if (room.orders[idx].userId !== userId) throw new Error("forbidden");
    room.orders.splice(idx, 1);
  }).catch((err: Error) => {
    if (err.message === "no-order") return "no-order" as const;
    if (err.message === "forbidden") return "forbidden" as const;
    throw err;
  });

  if (updated === "no-order") {
    return NextResponse.json({ error: "order not found" }, { status: 404 });
  }
  if (updated === "forbidden") {
    return NextResponse.json(
      { error: "you can only remove your own entries" },
      { status: 403 }
    );
  }
  if (!updated) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ room: updated });
}
