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

    const [todayAgg, cashAgg, onlineAgg, cashCountAgg, onlineCountAgg, changeAgg, itemsAgg, productsCount, stockAgg, recent, lowStock, weekSales, topProductsRaw, todayItems, yesterdayAgg, discountAgg, todayStaffRows] =
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
        // Z-report extras: transaction counts per method + change handed back today
        db.sale.aggregate({
          _count: true,
          where: { createdAt: { gte: since }, paymentMethod: "CASH" },
        }),
        db.sale.aggregate({
          _count: true,
          where: { createdAt: { gte: since }, paymentMethod: "ONLINE" },
        }),
        db.sale.aggregate({
          _sum: { changeReturned: true },
          where: { createdAt: { gte: since } },
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
        // Best sellers (all-time units sold) for the dashboard strip
        db.product.findMany({
          where: { soldQuantity: { gt: 0 } },
          orderBy: { soldQuantity: "desc" },
          take: 6,
          select: { id: true, productId: true, name: true, category: true, price: true, soldQuantity: true },
        }),
        // Today's item lines for the end-of-day report top sellers
        db.saleItem.findMany({
          where: { sale: { createdAt: { gte: since } } },
          select: { name: true, quantity: true, subtotal: true },
        }),
        // Yesterday's total for the "vs yesterday" delta on the hero card
        db.sale.aggregate({
          _sum: { total: true },
          where: {
            createdAt: { gte: new Date(dayStart - 86_400_000), lt: since },
          },
        }),
        // Discounts given today (Z-report line + dashboard)
        db.sale.aggregate({
          _sum: { discount: true },
          where: { createdAt: { gte: since }, discount: { gt: 0 } },
        }),
        // Per-salesman breakdown for today (staff card)
        db.sale.groupBy({
          by: ["salesman"],
          where: { createdAt: { gte: since } },
          _count: true,
          _sum: { total: true },
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

    // Group today's item lines by product name for the Z-report
    const itemMap = new Map<string, { quantity: number; revenue: number }>();
    for (const it of todayItems) {
      const cur = itemMap.get(it.name) ?? { quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.subtotal;
      itemMap.set(it.name, cur);
    }
    const topItems = Array.from(itemMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue)
      .slice(0, 5);

    const staffToday = todayStaffRows
      .map((r) => ({ salesman: r.salesman, count: r._count, total: r._sum.total ?? 0 }))
      .sort((a, b) => b.total - a.total);

    const stats: Stats = {
      todaySales: todayAgg._sum.total ?? 0,
      yesterdayTotal: yesterdayAgg._sum.total ?? 0,
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
      topProducts: topProductsRaw,
      staffToday,
      report: {
        cashCount: cashCountAgg._count,
        onlineCount: onlineCountAgg._count,
        changeGiven: changeAgg._sum.changeReturned ?? 0,
        discountTotal: discountAgg._sum.discount ?? 0,
        topItems,
      },
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
