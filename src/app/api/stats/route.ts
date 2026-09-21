import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import type { Stats } from "@/lib/types";

// GET /api/stats?tzOffset=-300 — owner dashboard numbers for the client's "today"
export async function GET(req: Request) {
  try {
    await ensureSeed();
    const url = new URL(req.url);
    const tzOffset = Number(url.searchParams.get("tzOffset") ?? 0) || 0;

    const now = Date.now();
    const dayStart = Math.floor((now - tzOffset * 60_000) / 86_400_000) * 86_400_000 + tzOffset * 60_000;
    const since = new Date(dayStart);

    const [todayAgg, cashAgg, onlineAgg, itemsAgg, productsCount, stockAgg, recent, lowStock, weekSales] =
      await Promise.all([
        db.sale.aggregate({
          _sum: { total: true },
          _count: true,
          where: { createdAt: { gte: since } },
        }),
        db.sale.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: since }, paymentMethod: "CASH" },
        }),
        db.sale.aggregate({
          _sum: { total: true },
          where: { createdAt: { gte: since }, paymentMethod: "ONLINE" },
        }),
        db.saleItem.aggregate({
          _sum: { quantity: true },
          where: { sale: { createdAt: { gte: since } } },
        }),
        db.product.count(),
        db.product.aggregate({ _sum: { stock: true } }),
        db.sale.findMany({
          orderBy: { id: "desc" },
          take: 6,
          include: { items: true },
        }),
        db.product.findMany({
          where: { stock: { lte: 5 } },
          orderBy: { stock: "asc" },
          take: 6,
        }),
        // Last 7 days (incl. today) for the trend strip
        db.sale.findMany({
          where: { createdAt: { gte: new Date(dayStart - 6 * 86_400_000) } },
          select: { total: true, createdAt: true },
        }),
      ]);

    const products = await db.product.findMany({ select: { price: true, stock: true } });
    const stockValue = products.reduce((sum, p) => sum + p.price * p.stock, 0);

    // Bucket the week's sales into per-day totals (client timezone day boundaries)
    const buckets = new Map<string, { total: number; count: number }>();
    for (const s of weekSales) {
      const dayKey = new Date(
        Math.floor((s.createdAt.getTime() - tzOffset * 60_000) / 86_400_000) * 86_400_000
      )
        .toISOString()
        .slice(0, 10);
      const b = buckets.get(dayKey) ?? { total: 0, count: 0 };
      b.total += s.total;
      b.count += 1;
      buckets.set(dayKey, b);
    }
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const trend = Array.from({ length: 7 }, (_, i) => {
      const ms = dayStart + (i - 6) * 86_400_000;
      const date = new Date(ms).toISOString().slice(0, 10);
      const b = buckets.get(date) ?? { total: 0, count: 0 };
      return { date, label: weekday[new Date(ms).getUTCDay()], total: b.total, count: b.count };
    });

    const stats: Stats = {
      todaySales: todayAgg._sum.total ?? 0,
      salesTodayCount: todayAgg._count,
      cashToday: cashAgg._sum.total ?? 0,
      onlineToday: onlineAgg._sum.total ?? 0,
      itemsSoldToday: itemsAgg._sum.quantity ?? 0,
      productsCount,
      stockAvailable: stockAgg._sum.stock ?? 0,
      stockValue,
      lowStock,
      recentSales: recent,
      trend,
    };
    return NextResponse.json(stats);
  } catch (err) {
    console.error("stats error", err);
    return NextResponse.json(
      { error: "Unable to load dashboard data right now." },
      { status: 500 }
    );
  }
}
