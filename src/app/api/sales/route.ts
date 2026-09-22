import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // POS data must never be cached/prerendered
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

// GET /api/sales?limit=100&salesman=Salesman&since=<iso|ms>
export async function GET(req: Request) {
  try {
    await ensureSeed();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit") ?? 100) || 100, 500);
    const salesman = url.searchParams.get("salesman")?.trim();
    const sinceRaw = url.searchParams.get("since");
    const since = sinceRaw ? new Date(sinceRaw) : null;

    const sales = await db.sale.findMany({
      orderBy: { id: "desc" },
      take: limit,
      where: {
        ...(salesman ? { salesman } : {}),
        ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gte: since } } : {}),
      },
      include: { items: true },
    });
    return NextResponse.json({ sales });
  } catch (err) {
    console.error("sales list error", err);
    return NextResponse.json(
      { error: "Unable to load sales history right now." },
      { status: 500 }
    );
  }
}

// POST /api/sales — complete a sale (atomic: stock check, sale record, stock update)
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);
    const rawItems: Array<{ productId: number; quantity: number }> = Array.isArray(
      body?.items
    )
      ? body.items
      : [];
    const paymentMethod = String(body?.paymentMethod ?? "").toUpperCase();

    if (rawItems.length === 0) {
      return NextResponse.json({ error: "The cart is empty." }, { status: 400 });
    }
    if (paymentMethod !== "CASH" && paymentMethod !== "ONLINE") {
      return NextResponse.json(
        { error: "Please select a payment method." },
        { status: 400 }
      );
    }
    for (const it of rawItems) {
      if (!Number.isInteger(Number(it.productId)) || !Number.isInteger(Number(it.quantity)) || Number(it.quantity) <= 0) {
        return NextResponse.json(
          { error: "Please enter a valid quantity." },
          { status: 400 }
        );
      }
    }

    const salesman = String(body?.salesman ?? "Salesman").trim() || "Salesman";
    const amountReceived =
      body?.amountReceived === undefined || body?.amountReceived === null
        ? null
        : Number(body.amountReceived);
    // Optional per-sale discount in Rs (e.g. 50) — must be ≥ 0 and ≤ the item subtotal
    const discount =
      body?.discount === undefined || body?.discount === null || Number(body.discount) === 0
        ? 0
        : Number(body.discount);
    if (!Number.isFinite(discount) || discount < 0) {
      return NextResponse.json(
        { error: "Discount must be a positive amount." },
        { status: 400 }
      );
    }

    try {
      const sale = await db.$transaction(async (tx) => {
        // Load products inside the transaction for a consistent stock check
        const ids = rawItems.map((i) => Number(i.productId));
        const products = await tx.product.findMany({ where: { id: { in: ids } } });
        const map = new Map(products.map((p) => [p.id, p]));

        let total = 0;
        const lines: Array<{
          productId: number;
          name: string;
          quantity: number;
          price: number;
          subtotal: number;
        }> = [];

        for (const it of rawItems) {
          const p = map.get(Number(it.productId));
          if (!p) {
            throw new Error("A product in the cart no longer exists. Please refresh and try again.");
          }
          const qty = Number(it.quantity);
          if (p.stock < qty) {
            throw new Error(
              `Insufficient stock. Only ${p.stock} ${p.stock === 1 ? "item is" : "items are"} available for ${p.name}.`
            );
          }
          const subtotal = p.price * qty;
          total += subtotal;
          lines.push({ productId: p.id, name: p.name, quantity: qty, price: p.price, subtotal });
        }

        if (discount > total) {
          throw new Error("Discount cannot be larger than the order total.");
        }
        total = Math.round((total - discount) * 100) / 100;

        let received: number;
        let change = 0;
        if (paymentMethod === "CASH") {
          if (amountReceived === null || !Number.isFinite(amountReceived)) {
            throw new Error("Please enter the amount the customer gave.");
          }
          if (amountReceived < total) {
            throw new Error("Payment amount is insufficient. The customer must pay the full total.");
          }
          received = amountReceived;
          change = Math.round((received - total) * 100) / 100;
        } else {
          received = total;
        }

        // Sequential human-facing sale id (RR-000124) — based on the highest
        // existing number (NOT count) so an ID gap can never cause a duplicate.
        const existing = await tx.sale.findMany({ select: { saleId: true } });
        const maxNum = existing.reduce((m, s) => {
          const n = parseInt(s.saleId.slice(3), 10);
          return Number.isFinite(n) && n > m ? n : m;
        }, 0);
        const saleId = `RR-${String(maxNum + 1).padStart(6, "0")}`;

        const created = await tx.sale.create({
          data: {
            saleId,
            salesman,
            total,
            discount,
            paymentMethod,
            amountReceived: received,
            changeReturned: paymentMethod === "CASH" ? change : null,
            items: { create: lines },
          },
          include: { items: true },
        });

        for (const line of lines) {
          await tx.product.update({
            where: { id: line.productId },
            data: {
              stock: { decrement: line.quantity },
              soldQuantity: { increment: line.quantity },
            },
          });
        }

        return created;
      });

      return NextResponse.json({ sale }, { status: 201 });
    } catch (txErr) {
      const msg = txErr instanceof Error ? txErr.message : "Sale could not be completed.";
      // Business-rule failures become clean 400s
      const known = [
        "Insufficient stock",
        "Payment amount is insufficient",
        "Please enter",
        "no longer exists",
        "Discount cannot",
      ];
      if (known.some((k) => msg.includes(k))) {
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      throw txErr;
    }
  } catch (err) {
    console.error("sale create error", err);
    return NextResponse.json(
      { error: "Sale could not be completed. Please try again." },
      { status: 500 }
    );
  }
}
