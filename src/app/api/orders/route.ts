import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import type { OrderLine } from "@/lib/types";

/** Serialize an Order row (itemsJson → items array) for the client. */
function serialize<T extends { itemsJson: string; dueAt: Date | null }>(o: T) {
  let items: OrderLine[] = [];
  try {
    const parsed = JSON.parse(o.itemsJson);
    if (Array.isArray(parsed)) items = parsed;
  } catch {
    items = [];
  }
  const { itemsJson: _itemsJson, ...rest } = o;
  return { ...rest, items };
}

// GET /api/orders?status=PENDING|READY|DONE|CANCELLED&limit=100
export async function GET(req: Request) {
  try {
    await ensureSeed();
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim().toUpperCase();
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);

    const orders = await db.order.findMany({
      orderBy: { id: "desc" },
      take: limit,
      where: status ? { status } : {},
    });
    return NextResponse.json({ orders: orders.map(serialize) });
  } catch (err) {
    console.error("orders list error", err);
    return NextResponse.json({ error: "Unable to load pre-orders right now." }, { status: 500 });
  }
}

// POST /api/orders — take a new pre-order
// Body: { customerName, customerPhone, items: [{ code, quantity }], dueAt?, note?, createdBy }
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);

    const customerName = String(body?.customerName ?? "").trim();
    const customerPhone = String(body?.customerPhone ?? "").trim();
    const note = String(body?.note ?? "").trim().slice(0, 300);
    const createdBy = String(body?.createdBy ?? "Staff").trim() || "Staff";
    const rawItems: Array<{ code: string; quantity: number }> = Array.isArray(body?.items)
      ? body.items
      : [];

    if (!customerName) {
      return NextResponse.json({ error: "Customer name is required." }, { status: 400 });
    }
    if (customerPhone && !/^[0-9+\-\s()]{5,20}$/.test(customerPhone)) {
      return NextResponse.json({ error: "Please enter a valid phone number." }, { status: 400 });
    }
    if (rawItems.length === 0) {
      return NextResponse.json({ error: "Add at least one item to the order." }, { status: 400 });
    }
    for (const it of rawItems) {
      if (!it.code || typeof it.code !== "string") {
        return NextResponse.json({ error: "Each item needs a valid product ID." }, { status: 400 });
      }
      if (!Number.isInteger(Number(it.quantity)) || Number(it.quantity) <= 0 || Number(it.quantity) > 999) {
        return NextResponse.json({ error: "Please enter a valid quantity." }, { status: 400 });
      }
    }

    // dueAt is optional — accept any parseable date, store null otherwise
    let dueAt: Date | null = null;
    if (body?.dueAt) {
      const d = new Date(body.dueAt);
      if (!Number.isNaN(d.getTime())) dueAt = d;
    }

    try {
      const order = await db.$transaction(async (tx) => {
        // Resolve every code against the catalog and snapshot name + price
        const lines: OrderLine[] = [];
        let total = 0;
        for (const it of rawItems) {
          const code = String(it.code).trim();
          const p = await tx.product.findUnique({ where: { productId: code } });
          if (!p) {
            throw new Error(`No product found with ID "${code}".`);
          }
          const qty = Math.min(999, Number(it.quantity));
          const subtotal = Math.round(p.price * qty * 100) / 100;
          total += subtotal;
          lines.push({ code: p.productId, name: p.name, quantity: qty, price: p.price, subtotal });
        }
        total = Math.round(total * 100) / 100;

        // Sequential human-facing order id (RO-000001) — based on the highest
        // existing number (NOT count) so removing closed orders can never
        // cause a duplicate-ID collision.
        const existing = await tx.order.findMany({ select: { orderId: true } });
        const maxNum = existing.reduce((m, o) => {
          const n = parseInt(o.orderId.slice(3), 10);
          return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        const orderId = `RO-${String(maxNum + 1).padStart(6, "0")}`;

        return tx.order.create({
          data: {
            orderId,
            customerName: customerName.slice(0, 80),
            customerPhone: customerPhone.slice(0, 20),
            itemsJson: JSON.stringify(lines),
            total,
            status: "PENDING",
            dueAt,
            note,
            createdBy,
          },
        });
      });

      return NextResponse.json({ order: serialize(order) }, { status: 201 });
    } catch (txErr) {
      const msg = txErr instanceof Error ? txErr.message : "Pre-order could not be saved.";
      if (msg.includes("No product found")) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw txErr;
    }
  } catch (err) {
    console.error("order create error", err);
    return NextResponse.json({ error: "Pre-order could not be saved. Please try again." }, { status: 500 });
  }
}
