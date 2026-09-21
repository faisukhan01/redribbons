"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Banknote,
  Boxes,
  Package,
  RefreshCw,
  ShoppingBag,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard, RecentSaleRow } from "@/components/pos/shared";
import { api } from "@/lib/api";
import { formatNumber, formatPKR, greeting, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Stats } from "@/lib/types";
import type { View } from "@/components/pos/app-shell";

export function OwnerDashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            {formatPKR(stats?.todaySales ?? 0)}
          </p>
          <p className="relative mt-1 text-xs opacity-85">
            {formatNumber(stats?.salesTodayCount ?? 0)}{" "}
            {(stats?.salesTodayCount ?? 0) === 1 ? "transaction" : "transactions"} today
          </p>
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
        </div>

        {/* Recent transactions */}
        <div className="rounded-xl border bg-card p-5 lg:col-span-2">
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
            <div className="mt-2 divide-y divide-border">
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
          <div className="mt-3 flex flex-wrap gap-2">
            {stats.lowStock.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2",
                  p.stock <= 0
                    ? "border-destructive/30 bg-[#FBE9E7]"
                    : "border-warning/30 bg-[#FCF7EF]"
                )}
              >
                <div>
                  <p className="text-sm font-semibold leading-tight">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{p.productId}</span> · {p.category} ·{" "}
                    {formatPKR(p.price)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    p.stock <= 0 ? "bg-destructive text-white" : "bg-warning text-white"
                  )}
                >
                  {p.stock <= 0 ? "OUT" : `${p.stock} left`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-[#EAF4EE] px-3 py-2.5 text-sm font-semibold text-[#2E7D4F]">
            All products are well stocked — nothing needs restocking right now.
          </p>
        )}
      </div>
    </div>
  );
}
