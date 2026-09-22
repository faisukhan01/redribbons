import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // POS data must never be cached/prerendered
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

interface BackupItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}
interface BackupSale {
  saleId: string;
  salesman: string;
  total: number;
  discount?: number;
  paymentMethod: string;
  amountReceived: number | null;
  changeReturned: number | null;
  createdAt: string;
  items: BackupItem[];
}
interface BackupProduct {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  soldQuantity: number;
}
export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  products: BackupProduct[];
  sales: BackupSale[];
  settings?: Record<string, string>;
  orders?: BackupOrder[];
}

interface BackupOrder {
  orderId: string;
  customerName: string;
  customerPhone: string;
  items: Array<{ code: string; name: string; quantity: number; price: number; subtotal: number }>;
  total: number;
  advance?: number;
  status: string;
  dueAt: string | null;
  note: string;
  createdBy: string;
  createdAt: string;
}

// GET /api/backup — download a full JSON snapshot (products + sales + settings)
export async function GET() {
  try {
    await ensureSeed();
    const [products, sales, settingRows, orders] = await Promise.all([
      db.product.findMany({
        orderBy: { productId: "asc" },
        select: {
          productId: true,
          name: true,
          category: true,
          price: true,
          stock: true,
          soldQuantity: true,
        },
      }),
      db.sale.findMany({
        orderBy: { id: "asc" },
        include: {
          items: {
            include: { product: { select: { productId: true } } },
          },
        },
      }),
      db.setting.findMany(),
      db.order.findMany({ orderBy: { id: "asc" } }),
    ]);

    const backup: BackupFile = {
      app: "red-ribbons-pos",
      version: 1,
      exportedAt: new Date().toISOString(),
      products,
      sales: sales.map((s) => ({
        saleId: s.saleId,
        salesman: s.salesman,
        total: s.total,
        discount: s.discount,
        paymentMethod: s.paymentMethod,
        amountReceived: s.amountReceived,
        changeReturned: s.changeReturned,
        createdAt: s.createdAt.toISOString(),
        items: s.items.map((i) => ({
          productId: i.product.productId,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          subtotal: i.subtotal,
        })),
      })),
      settings: Object.fromEntries(settingRows.map((r) => [r.key, r.value])),
      orders: orders.map((o) => {
        let items: BackupOrder["items"] = [];
        try {
          const parsed = JSON.parse(o.itemsJson);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items = [];
        }
        return {
          orderId: o.orderId,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          items,
          total: o.total,
          advance: o.advance,
          status: o.status,
          dueAt: o.dueAt ? o.dueAt.toISOString() : null,
          note: o.note,
          createdBy: o.createdBy,
          createdAt: o.createdAt.toISOString(),
        };
      }),
    };
    return NextResponse.json(backup);
  } catch (err) {
    console.error("backup error", err);
    return NextResponse.json(
      { error: "Could not create the backup right now." },
      { status: 500 }
    );
  }
}

// POST /api/backup — restore from a JSON snapshot (replaces products & sales)
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = (await req.json().catch(() => null)) as BackupFile | null;
    if (!body || body.app !== "red-ribbons-pos" || !Array.isArray(body.products) || !Array.isArray(body.sales)) {
      return NextResponse.json(
        { error: "This file is not a valid Red Ribbons backup." },
        { status: 400 }
      );
    }

    // Validate products
    const products: BackupProduct[] = [];
    const seenIds = new Set<string>();
    for (const p of body.products) {
      const id = String(p?.productId ?? "").trim();
      const name = String(p?.name ?? "").trim();
      const category = String(p?.category ?? "").trim() || "Bakery";
      const price = Number(p?.price);
      const stock = Math.max(0, Math.floor(Number(p?.stock) || 0));
      const sold = Math.max(0, Math.floor(Number(p?.soldQuantity) || 0));
      if (!id || !name || !Number.isFinite(price) || price < 0) {
        return NextResponse.json(
          { error: `Backup contains an invalid product row (ID "${id || "?"}").` },
          { status: 400 }
        );
      }
      if (seenIds.has(id)) {
        return NextResponse.json(
          { error: `Backup contains duplicate product ID "${id}".` },
          { status: 400 }
        );
      }
      seenIds.add(id);
      products.push({ productId: id, name, category, price, stock, soldQuantity: sold });
    }

    // Validate sales
    const sales: BackupSale[] = [];
    const seenSales = new Set<string>();
    for (const s of body.sales) {
      const saleId = String(s?.saleId ?? "").trim();
      const method = String(s?.paymentMethod ?? "").toUpperCase();
      if (!saleId || (method !== "CASH" && method !== "ONLINE")) {
        return NextResponse.json(
          { error: `Backup contains an invalid sale row (ID "${saleId || "?"}").` },
          { status: 400 }
        );
      }
      if (seenSales.has(saleId)) {
        return NextResponse.json(
          { error: `Backup contains duplicate sale ID "${saleId}".` },
          { status: 400 }
        );
      }
      seenSales.add(saleId);
      const created = s.createdAt ? new Date(s.createdAt) : new Date();
      sales.push({
        saleId,
        salesman: String(s?.salesman ?? "Salesman").trim() || "Salesman",
        total: Number(s?.total) || 0,
        discount: Math.max(0, Number(s?.discount) || 0),
        paymentMethod: method,
        amountReceived: s?.amountReceived == null ? null : Number(s.amountReceived),
        changeReturned: s?.changeReturned == null ? null : Number(s.changeReturned),
        createdAt: Number.isNaN(created.getTime()) ? new Date() : created,
        items: Array.isArray(s.items)
          ? s.items.map((i) => ({
              productId: String(i?.productId ?? "").trim(),
              name: String(i?.name ?? "").trim(),
              quantity: Math.max(0, Math.floor(Number(i?.quantity) || 0)),
              price: Number(i?.price) || 0,
              subtotal: Number(i?.subtotal) || 0,
            }))
          : [],
      });
    }

    const result = await db.$transaction(async (tx) => {
      await tx.saleItem.deleteMany();
      await tx.sale.deleteMany();
      await tx.product.deleteMany();

      const idMap = new Map<string, number>();
      for (const p of products) {
        const created = await tx.product.create({
          data: {
            productId: p.productId,
            name: p.name,
            category: p.category,
            price: p.price,
            stock: p.stock,
            soldQuantity: p.soldQuantity,
          },
        });
        idMap.set(p.productId, created.id);
      }

      let restoredSales = 0;
      let restoredItems = 0;
      let skippedItems = 0;
      for (const s of sales) {
        const lines = s.items
          .filter((i) => i.quantity > 0 && idMap.has(i.productId))
          .map((i) => ({
            productId: idMap.get(i.productId)!,
            name: i.name || "Item",
            quantity: i.quantity,
            price: i.price,
            subtotal: i.subtotal > 0 ? i.subtotal : i.price * i.quantity,
          }));
        skippedItems += s.items.length - lines.length;
        if (lines.length === 0) continue;
        await tx.sale.create({
          data: {
            saleId: s.saleId,
            salesman: s.salesman,
            total: s.total,
            discount: s.discount ?? 0,
            paymentMethod: s.paymentMethod,
            amountReceived: s.amountReceived,
            changeReturned: s.changeReturned,
            createdAt: s.createdAt,
            items: { create: lines },
          },
        });
        restoredSales += 1;
        restoredItems += lines.length;
      }
      return { products: products.length, sales: restoredSales, items: restoredItems, skippedItems };
    });

    // Restore receipt settings (outside the data transaction — non-critical)
    if (body.settings && typeof body.settings === "object") {
      for (const key of ["shopPhone", "shopAddress", "receiptNote", "paperWidth"]) {
        const value = body.settings[key];
        if (typeof value === "string" && value.trim() !== "") {
          const clean = key === "paperWidth" ? (value.trim() === "58" ? "58" : "80") : value.trim().slice(0, 200);
          await db.setting.upsert({
            where: { key },
            update: { value: clean },
            create: { key, value: clean },
          });
        }
      }
    }

    // Restore pre-orders (non-critical — a v1 backup without orders still restores)
    let restoredOrders = 0;
    if (Array.isArray(body.orders)) {
      for (const o of body.orders) {
        const orderId = String(o?.orderId ?? "").trim();
        const name = String(o?.customerName ?? "").trim();
        if (!orderId || !name) continue;
        const status = ["PENDING", "READY", "DONE", "CANCELLED"].includes(String(o?.status))
          ? String(o.status)
          : "PENDING";
        const due = o.dueAt ? new Date(o.dueAt) : null;
        await db.order.upsert({
          where: { orderId },
          update: {},
          create: {
            orderId,
            customerName: name.slice(0, 80),
            customerPhone: String(o?.customerPhone ?? "").trim().slice(0, 20),
            itemsJson: JSON.stringify(Array.isArray(o.items) ? o.items : []),
            total: Number(o?.total) || 0,
            advance: Math.max(0, Number(o?.advance) || 0),
            status,
            dueAt: due && !Number.isNaN(due.getTime()) ? due : null,
            note: String(o?.note ?? "").slice(0, 300),
            createdBy: String(o?.createdBy ?? "Staff").trim() || "Staff",
            createdAt: o.createdAt && !Number.isNaN(new Date(o.createdAt).getTime()) ? new Date(o.createdAt) : new Date(),
          },
        });
        restoredOrders += 1;
      }
    }

    return NextResponse.json({ ok: true, ...result, orders: restoredOrders });
  } catch (err) {
    console.error("backup restore error", err);
    return NextResponse.json(
      { error: "Restore failed. The database was left unchanged." },
      { status: 500 }
    );
  }
}
