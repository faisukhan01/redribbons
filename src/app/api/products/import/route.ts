import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import type { ImportResult, ImportSkip, ImportRow } from "@/lib/types";

/**
 * POST /api/products/import
 * Body: { rows: ImportRow[] } — already parsed client-side from Excel/CSV.
 * Every row is re-validated server-side; invalid rows are skipped and reported.
 */
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);
    const rows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];

    if (rows.length === 0) {
      return NextResponse.json({ error: "The file has no products to import." }, { status: 400 });
    }
    if (rows.length > 2000) {
      return NextResponse.json(
        { error: "Please import up to 2,000 products at a time." },
        { status: 400 }
      );
    }

    const skips: ImportSkip[] = [];
    const valid: ImportRow[] = [];
    const seenIds = new Set<string>();
    const codeRe = /^[A-Za-z0-9_-]+$/;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as Record<string, unknown>;
      const rowNo = i + 1;
      const productId = String(r?.productId ?? "").trim();
      const name = String(r?.name ?? "").trim();
      const category = String(r?.category ?? "").trim() || "Bakery";
      const price = Number(r?.price);
      const quantity = Number(r?.quantity);

      if (!productId) {
        skips.push({ row: rowNo, reason: "Missing Product ID" });
        continue;
      }
      if (!codeRe.test(productId)) {
        skips.push({ row: rowNo, reason: `Invalid Product ID "${productId}" (use letters/numbers only)` });
        continue;
      }
      if (!name) {
        skips.push({ row: rowNo, reason: `Missing product name for ID ${productId}` });
        continue;
      }
      if (!Number.isFinite(price) || price <= 0) {
        skips.push({ row: rowNo, reason: `Invalid price for ${name || productId}` });
        continue;
      }
      if (!Number.isInteger(quantity) || quantity < 0) {
        skips.push({ row: rowNo, reason: `Invalid quantity for ${name || productId}` });
        continue;
      }
      if (seenIds.has(productId.toUpperCase())) {
        skips.push({ row: rowNo, reason: `Duplicate Product ID "${productId}" in file` });
        continue;
      }
      seenIds.add(productId.toUpperCase());
      valid.push({ productId, name, category, price, quantity });
    }

    // Skip rows whose Product ID already exists in the database
    const toCheck = valid.map((v) => v.productId);
    const existing = await db.product.findMany({
      where: { productId: { in: toCheck } },
      select: { productId: true, name: true },
    });
    const existingMap = new Map(existing.map((e) => [e.productId.toUpperCase(), e.name]));

    const finalRows: ImportRow[] = [];
    for (let i = 0; i < valid.length; i++) {
      const v = valid[i];
      const existingName = existingMap.get(v.productId.toUpperCase());
      if (existingName) {
        skips.push({
          row: toCheck.indexOf(v.productId) + 1,
          reason: `Product ID "${v.productId}" already exists (${existingName})`,
        });
      } else {
        finalRows.push(v);
      }
    }

    if (finalRows.length > 0) {
      await db.product.createMany({
        data: finalRows.map((v) => ({
          productId: v.productId,
          name: v.name,
          category: v.category,
          price: v.price,
          stock: v.quantity,
        })),
      });
    }

    const result: ImportResult = { imported: finalRows.length, skipped: skips };
    return NextResponse.json(result);
  } catch (err) {
    console.error("import error", err);
    return NextResponse.json(
      { error: "Import failed. Please check the file and try again." },
      { status: 500 }
    );
  }
}
