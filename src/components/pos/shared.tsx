"use client";

import { Banknote, Package, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPKR } from "@/lib/format";
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
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-2 text-xl sm:text-2xl font-bold tabular-nums text-foreground">
        {value}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
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
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-full flex-col justify-between gap-1.5 rounded-lg border bg-card p-2.5 text-left transition-colors",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-primary/50 hover:bg-accent/60 active:bg-accent"
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
    <div className="flex items-center justify-between gap-3 py-2.5">
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
