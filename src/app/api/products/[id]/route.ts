import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/products/:id — update details and/or add stock
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const internalId = Number(id);
    if (!Number.isInteger(internalId)) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const product = await db.product.findUnique({ where: { id: internalId } });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const data: {
      name?: string;
      category?: string;
      price?: number;
      stock?: number;
    } = {};

    if (body?.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json({ error: "Product name cannot be empty." }, { status: 400 });
      }
      data.name = name;
    }
    if (body?.category !== undefined) {
      const category = String(body.category).trim();
      if (!category) {
        return NextResponse.json({ error: "Category cannot be empty." }, { status: 400 });
      }
      data.category = category;
    }
    if (body?.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json(
          { error: "Price must be a valid amount greater than 0." },
          { status: 400 }
        );
      }
      data.price = price;
    }
    if (body?.addStock !== undefined) {
      const addStock = Number(body.addStock);
      if (!Number.isInteger(addStock) || addStock <= 0) {
        return NextResponse.json(
          { error: "Please enter a valid quantity to add." },
          { status: 400 }
        );
      }
      data.stock = product.stock + addStock;
    }

    const updated = await db.product.update({ where: { id: internalId }, data });
    return NextResponse.json({ product: updated });
  } catch (err) {
    console.error("product update error", err);
    return NextResponse.json(
      { error: "Unable to update the product right now." },
      { status: 500 }
    );
  }
}

// DELETE /api/products/:id
export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const internalId = Number(id);
    if (!Number.isInteger(internalId)) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const product = await db.product.findUnique({
      where: { id: internalId },
      include: { _count: { select: { saleItems: true } } },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }
    if (product._count.saleItems > 0) {
      return NextResponse.json(
        {
          error:
            "This product has sales records, so it cannot be deleted. You can set its quantity to 0 instead.",
        },
        { status: 400 }
      );
    }

    await db.product.delete({ where: { id: internalId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("product delete error", err);
    return NextResponse.json(
      { error: "Unable to delete the product right now." },
      { status: 500 }
    );
  }
}
