import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

const STATUSES = ["PENDING", "READY", "DONE", "CANCELLED"] as const;

// PATCH /api/orders/[id] — update status (and optionally the note)
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeed();
    const { id } = await ctx.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    const status = String(body?.status ?? "").trim().toUpperCase();
    if (!(STATUSES as readonly string[]).includes(status)) {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }

    const existing = await db.order.findUnique({ where: { id: numericId } });
    if (!existing) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    if (existing.status === "DONE" || existing.status === "CANCELLED") {
      return NextResponse.json(
        { error: `This order is already ${existing.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const data: { status: string; note?: string } = { status };
    if (typeof body?.note === "string") data.note = body.note.trim().slice(0, 300);

    const order = await db.order.update({ where: { id: numericId }, data });
    return NextResponse.json({ order: { id: order.id, orderId: order.orderId, status: order.status } });
  } catch (err) {
    console.error("order patch error", err);
    return NextResponse.json({ error: "Unable to update the order." }, { status: 500 });
  }
}

// DELETE /api/orders/[id] — remove a cancelled/done order from the book
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ensureSeed();
    const { id } = await ctx.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      return NextResponse.json({ error: "Invalid order." }, { status: 400 });
    }

    const existing = await db.order.findUnique({ where: { id: numericId } });
    if (!existing) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }
    // A live (pending/ready) order must be cancelled first — keeps an audit trail
    if (existing.status === "PENDING" || existing.status === "READY") {
      return NextResponse.json(
        { error: "Cancel this order before removing it." },
        { status: 400 }
      );
    }

    await db.order.delete({ where: { id: numericId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("order delete error", err);
    return NextResponse.json({ error: "Unable to remove the order." }, { status: 500 });
  }
}
