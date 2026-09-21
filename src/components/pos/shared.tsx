"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Package, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, formatPKR } from "@/lib/format";
import type { Sale } from "@/lib/types";

export function PaymentBadge({
  method,
  className,
}: {
  method: string;
  className?: string;
}) {
  const cash = method === "CASH";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        cash
          ? "bg-secondary text-secondary-foreground"
          : "bg-[#EAF4EE] text-[#2E7D4F]",
        className
      )}
    >
      {cash ? <Banknote className="h-3 w-3" /> : <Smartphone className="h-3 w-3" />}
      {cash ? "Cash" : "Online"}
    </span>
  );
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="inline-flex rounded-full bg-[#FBE9E7] px-2 py-0.5 text-[11px] font-semibold text-destructive">
        Out of stock
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="inline-flex rounded-full bg-[#FCF0DF] px-2 py-0.5 text-[11px] font-semibold text-warning">
        Low · {stock}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-[#EAF4EE] px-2 py-0.5 text-[11px] font-semibold text-[#2E7D4F]">
      {stock} in stock
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:border-primary/25 hover:shadow-[0_8px_24px_-14px_rgba(122,15,21,0.4)] sm:p-5">
      {/* brand accent line that reveals on hover */}
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-primary to-[#7A0F15] transition-transform duration-300 group-hover:scale-x-100"
      />
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2.5 text-xl font-bold tabular-nums text-foreground sm:text-2xl">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

/** Animated number count-up (eased, respects prefers-reduced-motion). */
export function CountUp({
  value,
  format,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const from = prevRef.current;
    const to = value;
    if (from === to) return; // display already converged to the previous target
    prevRef.current = to;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduce ? 0 : 750;
    const start = performance.now();
    let raf = 0;
    function tick(now: number) {
      const p = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const fmt =
    format ??
    ((n: number) => formatNumber(Math.round(n)));
  return (
    <span className={className} aria-label={fmt(value)}>
      {fmt(display)}
    </span>
  );
}

/** Product tile used in the POS quick-grid. */
export function ProductTile({
  name,
  price,
  stock,
  onClick,
}: {
  name: string;
  price: number;
  stock: number;
  onClick: () => void;
}) {
  const disabled = stock <= 0;
  const low = !disabled && stock <= 5;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-full flex-col justify-between gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-all",
        disabled
          ? "cursor-not-allowed border-destructive/20 bg-destructive/5 opacity-60"
          : low
            ? "border-warning/40 hover:-translate-y-0.5 hover:border-warning hover:bg-accent/60 hover:shadow-[0_6px_16px_-8px_rgba(122,15,21,0.35)] active:translate-y-0 active:bg-accent"
            : "hover:-translate-y-0.5 hover:border-primary/50 hover:bg-accent/60 hover:shadow-[0_6px_16px_-8px_rgba(122,15,21,0.35)] active:translate-y-0 active:bg-accent"
      )}
    >
      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
        {name}
      </p>
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold tabular-nums text-primary">
          {formatPKR(price)}
        </span>
        <StockBadge stock={stock} />
      </div>
    </button>
  );
}

/** Compact recent-sale row used on the owner dashboard. */
export function RecentSaleRow({ sale }: { sale: Sale }) {
  const units = sale.items.reduce((s, i) => s + i.quantity, 0);
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/70 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="font-mono text-sm font-bold text-foreground">{sale.saleId}</p>
        <p className="truncate text-xs text-muted-foreground">
          {units} {units === 1 ? "item" : "items"} · {sale.salesman}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <PaymentBadge method={sale.paymentMethod} />
        <span className="text-sm font-bold tabular-nums">{formatPKR(sale.total)}</span>
      </div>
    </div>
  );
}
