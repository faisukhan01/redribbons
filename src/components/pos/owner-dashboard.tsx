"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Boxes,
  Crown,
  Package,
  PackagePlus,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  TrendingUp,
  TriangleAlert,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatCard, RecentSaleRow, CountUp } from "@/components/pos/shared";
import { ZReportDialog } from "@/components/pos/z-report";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import { useShopSettings } from "@/lib/settings";
import { formatNumber, formatPKR, greeting, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Stats } from "@/lib/types";
import type { View } from "@/components/pos/app-shell";

/** Mini 7-day bar strip — pure CSS, no chart library. */
function TrendStrip({ stats }: { stats: Stats }) {
  const trend = stats.trend;
  const max = Math.max(...trend.map((t) => t.total), 1);
  const weekTotal = trend.reduce((s, t) => s + t.total, 0);
  const weekCount = trend.reduce((s, t) => s + t.count, 0);
  const best = trend.reduce((b, t) => (t.total > b.total ? t : b), trend[0]);
  const allZero = weekTotal === 0;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold">
          <TrendingUp className="h-5 w-5 text-primary" />
          Last 7 Days
        </h2>
        <p className="text-sm text-muted-foreground">
          <span className="font-bold tabular-nums text-foreground">{formatPKR(weekTotal)}</span>
          {" · "}
          {formatNumber(weekCount)} {weekCount === 1 ? "sale" : "sales"}
        </p>
      </div>

      {allZero ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed py-6 text-center">
          <TrendingUp className="h-5 w-5 text-muted-foreground/40" />
          <p className="mt-1.5 text-sm font-semibold text-muted-foreground">
            No sales in the last 7 days yet.
          </p>
          <p className="text-xs text-muted-foreground">
            Complete a sale at the counter and today’s bar will rise here.
          </p>
        </div>
      ) : (
        <div className="mt-4 flex h-28 items-end gap-2 sm:gap-3">
          {trend.map((t, i) => {
            const isToday = i === trend.length - 1;
            const pct = Math.max(4, Math.round((t.total / max) * 100));
            return (
              <div key={t.date} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <p
                  className={cn(
                    "text-[10px] font-bold tabular-nums",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {t.total > 0 ? formatNumber(t.total) : "–"}
                </p>
                <div
                  role="img"
                  aria-label={`${t.label}: ${formatPKR(t.total)} from ${t.count} sales`}
                  title={`${t.label} · ${formatPKR(t.total)} · ${t.count} ${t.count === 1 ? "sale" : "sales"}`}
                  style={{ height: `${pct}%` }}
                  className={cn(
                    "w-full max-w-9 rounded-t-md transition-all duration-300 hover:opacity-80",
                    t.total === 0
                      ? "bg-muted"
                      : isToday
                        ? "bg-gradient-to-t from-[#7A0F15] to-primary shadow-[0_4px_12px_-4px_rgba(169,26,36,0.6)]"
                        : "bg-primary/45"
                  )}
                />
                <p
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {isToday ? "Today" : t.label}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {best && best.total > 0 ? (
        <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
          Best day: <span className="font-bold text-foreground">{best.label}</span> with{" "}
          <span className="font-bold tabular-nums text-foreground">{formatPKR(best.total)}</span>
        </p>
      ) : null}
    </div>
  );
}

export function OwnerDashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restocking, setRestocking] = useState<number | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const userName = useSession((s) => s.user?.name ?? "Owner");

  /** Quick restock: add 10 units without leaving the dashboard. */
  async function quickRestock(id: number, name: string) {
    setRestocking(id);
    try {
      await api(`/api/products/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ addStock: 10 }),
      });
      toast.success(`Added 10 units of ${name} to stock.`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not restock right now.");
    } finally {
      setRestocking(null);
    }
  }

  // Manual refresh (button) — never called during render
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const data = await api<Stats>(`/api/stats?tzOffset=${tzOffset}`);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load — setState happens in promise callbacks
  useEffect(() => {
    let cancelled = false;
    const tzOffset = new Date().getTimezoneOffset();
    api<Stats>(`/api/stats?tzOffset=${tzOffset}`)
      .then((data) => {
        if (!cancelled) setStats(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unable to load dashboard.");
      });
    void useShopSettings.getState().load(); // for Z-report shop lines
    return () => {
      cancelled = true;
    };
  }, []);

  const cash = stats?.cashToday ?? 0;
  const online = stats?.onlineToday ?? 0;
  const total = cash + online;
  const cashPct = total > 0 ? (cash / total) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
            {greeting()}, Abdullah
          </h1>
          <p className="text-sm text-muted-foreground">{formatDate(new Date().toISOString())} · Here is how the bakery is doing today.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setReportOpen(true)}
            disabled={!stats}
            className="gap-2 border-primary/30 font-bold text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <ReceiptText className="h-4 w-4" />
            End-of-Day Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {/* Hero: Today's Sales */}
        <div className="relative col-span-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-[#7A0F15] p-5 text-primary-foreground shadow-[0_12px_32px_-14px_rgba(122,15,21,0.6)] sm:col-span-2 lg:col-span-1">
          {/* decorative ribbon stripes */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-16 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(255,255,255,0.14) 0 7px, transparent 7px 15px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative flex items-center gap-2 opacity-90">
            <ShoppingBag className="h-4 w-4" />
            <p className="text-xs font-semibold uppercase tracking-widest">Today&apos;s Sales</p>
          </div>
          <p className="relative mt-2 text-3xl font-bold tabular-nums sm:text-4xl">
            <CountUp value={stats?.todaySales ?? 0} format={formatPKR} />
          </p>
          <div className="relative mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-xs opacity-85">
              {formatNumber(stats?.salesTodayCount ?? 0)}{" "}
              {(stats?.salesTodayCount ?? 0) === 1 ? "transaction" : "transactions"} today
            </p>
            {stats && (stats.yesterdayTotal > 0 || stats.todaySales > 0) ? (
              <YesterdayDelta today={stats.todaySales} yesterday={stats.yesterdayTotal} />
            ) : null}
          </div>
        </div>

        <StatCard
          label="Cash Sales"
          value={formatPKR(stats?.cashToday ?? 0)}
          icon={Banknote}
          sub="Today"
        />
        <StatCard
          label="Online Sales"
          value={formatPKR(stats?.onlineToday ?? 0)}
          icon={Smartphone}
          sub="Today"
        />
        <StatCard
          label="Items Sold Today"
          value={formatNumber(stats?.itemsSoldToday ?? 0)}
          icon={ShoppingBag}
          sub="Units across all sales"
        />
        <StatCard
          label="Products"
          value={formatNumber(stats?.productsCount ?? 0)}
          icon={Package}
          sub="In catalogue"
        />
        <StatCard
          label="Stock Available"
          value={formatNumber(stats?.stockAvailable ?? 0)}
          icon={Boxes}
          sub={`${formatPKR(stats?.stockValue ?? 0)} in stock value`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payment breakdown */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-1">
          <h2 className="font-display text-lg font-bold">Payment Split Today</h2>
          <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${cashPct}%` }}
              title="Cash"
            />
            <div
              className="h-full bg-[#2E7D4F] transition-all"
              style={{ width: `${100 - cashPct}%` }}
              title="Online"
            />
          </div>
          <div className="mt-4 space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Cash
              </span>
              <span className="font-bold tabular-nums">{formatPKR(cash)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-[#2E7D4F]" /> Online
              </span>
              <span className="font-bold tabular-nums">{formatPKR(online)}</span>
            </div>
          </div>

          {/* Staff sales today */}
          {stats && stats.staffToday.length > 0 ? (
            <div className="mt-4 border-t pt-3">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                <Users className="h-3.5 w-3.5" /> Staff sales today
              </p>
              <div className="mt-2 space-y-1.5">
                {stats.staffToday.map((s) => {
                  const top = stats.staffToday[0]?.total || 1;
                  const pct = Math.max(8, Math.round((s.total / top) * 100));
                  return (
                    <div key={s.salesman} title={`${s.salesman}: ${formatNumber(s.count)} sales · ${formatPKR(s.total)}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-semibold text-foreground">{s.salesman}</span>
                        <span className="shrink-0 tabular-nums font-bold text-foreground">
                          {formatPKR(s.total)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            style={{ width: `${pct}%` }}
                            className="h-full rounded-full bg-primary/60 rr-grow"
                            role="img"
                            aria-label={`${s.salesman}: ${formatPKR(s.total)} from ${s.count} sales`}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                          {formatNumber(s.count)} {s.count === 1 ? "sale" : "sales"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* 7-day trend */}
        <div className="lg:col-span-2">
          {stats ? <TrendStrip stats={stats} /> : null}
        </div>
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <Crown className="h-5 w-5 text-primary" />
            Best Sellers
          </h2>
          <p className="text-xs text-muted-foreground">All-time units sold</p>
        </div>
        {stats && stats.topProducts.length > 0 ? (
          <div className="mt-3 grid gap-x-8 md:grid-cols-2">
            {stats.topProducts.map((p, i) => {
              const max = Math.max(...stats.topProducts.map((x) => x.soldQuantity), 1);
              const pct = Math.max(6, Math.round((p.soldQuantity / max) * 100));
              return (
                <div
                  key={p.id}
                  className="group border-b border-border/70 py-2.5 last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
                          i === 0
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-primary"
                        )}
                      >
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold leading-tight">{p.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {p.category} · {formatPKR(p.price)}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold tabular-nums text-foreground">
                        {formatNumber(p.soldQuantity)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">sold</p>
                    </div>
                  </div>
                  <div className="mt-1.5 ml-[38px] h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      role="img"
                      aria-label={`${p.name}: ${p.soldQuantity} sold`}
                      title={`${p.name} · ${formatNumber(p.soldQuantity)} sold all-time`}
                      style={{ width: `${pct}%` }}
                      className={cn(
                        "h-full rounded-full rr-grow",
                        i === 0
                          ? "bg-gradient-to-r from-primary to-[#8E1620]"
                          : "bg-primary/40"
                      )}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No sales recorded yet — best sellers will appear here."}
          </p>
        )}
      </div>

      {/* Recent transactions */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recent Transactions</h2>
          <button
            type="button"
            onClick={() => onNavigate("sales")}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View all <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {stats && stats.recentSales.length > 0 ? (
          <div className="mt-2 grid gap-x-8 md:grid-cols-2">
            {stats.recentSales.map((sale) => (
              <RecentSaleRow key={sale.id} sale={sale} />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {loading ? "Loading…" : "No sales yet today."}
          </p>
        )}
      </div>

      {/* Low stock watchlist */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <TriangleAlert
              className={cn(
                "h-5 w-5",
                (stats?.lowStock.length ?? 0) > 0 ? "text-warning" : "text-[#2E7D4F]"
              )}
            />
            Low Stock Watchlist
          </h2>
          <button
            type="button"
            onClick={() => onNavigate("inventory")}
            className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            Open inventory <ArrowRight className="h-4 w-4" />
          </button>
        </div>
        {stats && stats.lowStock.length > 0 ? (
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {stats.lowStock.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2",
                  p.stock <= 0
                    ? "border-destructive/30 bg-[#FBE9E7]"
                    : "border-warning/30 bg-[#FCF7EF]"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{p.productId}</span> · {p.category} ·{" "}
                    {formatPKR(p.price)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-bold",
                      p.stock <= 0 ? "bg-destructive text-white" : "bg-warning text-white"
                    )}
                  >
                    {p.stock <= 0 ? "OUT" : `${p.stock} left`}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restocking === p.id}
                    onClick={() => void quickRestock(p.id, p.name)}
                    title={`Add 10 units of ${p.name}`}
                    className="h-8 gap-1.5 rounded-lg border-warning/40 px-2.5 text-xs font-bold text-warning hover:bg-warning hover:text-white"
                  >
                    <PackagePlus className="h-3.5 w-3.5" />
                    {restocking === p.id ? "Adding…" : "+10"}
                  </Button>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground md:col-span-2">
              Tip: “+10” instantly adds 10 units. For other amounts, use Inventory → Restock.
            </p>
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-[#EAF4EE] px-3 py-2.5 text-sm font-semibold text-[#2E7D4F]">
            All products are well stocked — nothing needs restocking right now.
          </p>
        )}
      </div>

      {/* End-of-day report preview + print */}
      <ZReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        stats={stats}
        closedBy={userName}
      />
    </div>
  );
}

/** Small pill comparing today's sales against yesterday. */
function YesterdayDelta({ today, yesterday }: { today: number; yesterday: number }) {
  if (yesterday <= 0) {
    return (
      <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-bold">
        First sale of the week 🎉
      </span>
    );
  }
  const delta = ((today - yesterday) / yesterday) * 100;
  const up = delta >= 0;
  return (
    <span
      title={`Yesterday: ${formatPKR(yesterday)}`}
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        up ? "bg-[#2E7D4F]/25 text-white" : "bg-black/20 text-white"
      )}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta).toFixed(0)}% vs yesterday
    </span>
  );
}
