import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

// GET /api/products — full product list (client filters for speed)
export async function GET() {
  try {
    await ensureSeed();
    const products = await db.product.findMany({ orderBy: { productId: "asc" } });
    return NextResponse.json({ products });
  } catch (err) {
    console.error("products list error", err);
    return NextResponse.json(
      { error: "Unable to load products right now." },
      { status: 500 }
    );
  }
}

// POST /api/products — create a product
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);

    const productId = String(body?.productId ?? "").trim();
    const name = String(body?.name ?? "").trim();
    const category = String(body?.category ?? "").trim() || "Bakery";
    const price = Number(body?.price);
    const stock = Number(body?.stock ?? 0);

    if (!productId) {
      return NextResponse.json({ error: "Please enter a Product ID." }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Please enter a product name." }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json(
        { error: "Price must be a valid amount greater than 0." },
        { status: 400 }
      );
    }
    if (!Number.isInteger(stock) || stock < 0) {
      return NextResponse.json(
        { error: "Quantity cannot be negative." },
        { status: 400 }
      );
    }

    const existing = await db.product.findUnique({ where: { productId } });
    if (existing) {
      return NextResponse.json(
        { error: `Product ID ${productId} already exists (${existing.name}).` },
        { status: 409 }
      );
    }

    const product = await db.product.create({
      data: { productId, name, category, price, stock },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    console.error("product create error", err);
    return NextResponse.json(
      { error: "Unable to save the product right now." },
      { status: 500 }
    );
  }
}
