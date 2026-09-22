"use client";

import Image from "next/image";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { useShopSettings } from "@/lib/settings";
import { formatDateTime, formatPKR } from "@/lib/format";
import type { Order } from "@/lib/types";

/**
 * Thermal-style memo ticket for a pre-order (80mm look, honours the 58mm
 * paper setting). Printed from the pre-order book so the kitchen/baker has a
 * physical slip of what to prepare — and the customer gets a booking slip.
 * Not a receipt: no payment lines, footer says "Pay at pickup".
 */
export function OrderMemo({ order, className }: { order: Order; className?: string }) {
  const settings = useShopSettings((s) => s.settings);
  const units = order.items.reduce((s, i) => s + i.quantity, 0);
  const narrow = settings?.paperWidth === "58";

  return (
    <div
      className={cn(
        "rr-receipt mx-auto w-full bg-white px-5 py-6 text-[11px] leading-relaxed text-foreground shadow-sm ring-1 ring-black/5",
        narrow ? "rr-receipt--58 max-w-[220px]" : "max-w-[300px]",
        className
      )}
    >
      {/* Brand header */}
      <div className="flex flex-col items-center text-center">
        <Image src="/logo-mark.png" alt="" width={1011} height={975} className="h-12 w-auto" />
        <p className="mt-1.5 font-display text-lg font-bold tracking-wide text-primary">
          RED RIBBONS
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Bakery · Pre-order Memo
        </p>
        {settings?.shopAddress ? (
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {settings.shopAddress}
          </p>
        ) : null}
        {settings?.shopPhone ? (
          <p className="text-[10px] font-semibold text-muted-foreground">
            ☎ {settings.shopPhone}
          </p>
        ) : null}
      </div>

      <MemoDivider />

      {/* Meta */}
      <div className="space-y-0.5">
        <MemoRow label="Order" value={order.orderId} strong />
        <MemoRow label="Booked" value={formatDateTime(order.createdAt)} />
        <MemoRow label="Customer" value={order.customerName} strong />
        {order.customerPhone ? (
          <MemoRow label="Phone" value={order.customerPhone} />
        ) : null}
        <MemoRow
          label="Pickup"
          value={order.dueAt ? formatDateTime(order.dueAt) : "To be scheduled"}
          strong
        />
      </div>

      <MemoDivider />

      {/* Items */}
      <ul className="space-y-1.5">
        {order.items.map((item, idx) => (
          <li key={idx}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                {item.quantity} × {item.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatPKR(item.subtotal)}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              code {item.code}
              {item.quantity > 1 ? ` · @ ${formatPKR(item.price)} each` : ""}
            </p>
          </li>
        ))}
      </ul>

      <MemoDivider />

      {/* Total */}
      <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
        <span className="uppercase tracking-wider">
          Total <span className="font-medium normal-case tracking-normal">({units} items)</span>
        </span>
        <span className="tabular-nums">{formatPKR(order.total)}</span>
      </div>

      {/* Advance / balance */}
      {order.advance > 0 ? (
        <>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[11px] font-semibold">
            <span className="uppercase tracking-wider">Advance paid</span>
            <span className="tabular-nums">{formatPKR(order.advance)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2 text-sm font-bold">
            <span className="uppercase tracking-wider">Balance due</span>
            <span className="tabular-nums">{formatPKR(Math.max(0, order.total - order.advance))}</span>
          </div>
        </>
      ) : null}

      {order.note ? (
        <>
          <MemoDivider />
          <p className="text-[10px] font-semibold italic leading-snug">
            Note: {order.note}
          </p>
        </>
      ) : null}

      <MemoDivider />

      {/* Footer */}
      <div className="space-y-0.5 text-center text-muted-foreground">
        <p className="text-[11px] font-semibold text-foreground">
          {order.advance > 0 ? "Pay balance at pickup — Cash or Online" : "Pay at pickup — Cash or Online"}
        </p>
        <p className="text-[11px] font-semibold text-foreground" style={{ direction: "rtl" }}>
          {order.advance > 0 ? "بقیہ رقم پک اپ کے وقت" : "پک اپ کے وقت ادائیگی"}
        </p>
        <p className="text-[9px] uppercase tracking-[0.25em]">Red Ribbons Bakery</p>
        <p className="text-[9px]">
          Booked by {order.createdBy}
          {order.status === "CANCELLED" ? " · CANCELLED" : ""}
        </p>
      </div>
    </div>
  );
}

function MemoDivider() {
  return <div aria-hidden className="my-3 border-t border-dashed border-foreground/25" />;
}

function MemoRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn("min-w-0 truncate text-right", strong ? "font-bold" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}

/**
 * Print an order memo: renders the memo into a dedicated print root,
 * triggers the browser print dialog, then cleans up. All other page content
 * is hidden via the @media print rules in globals.css.
 */
export function printOrderMemo(order: Order) {
  if (typeof window === "undefined") return;
  const host = document.createElement("div");
  host.className = "rr-print-root";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<OrderMemo order={order} />));
    window.print();
  } finally {
    root.unmount();
    host.remove();
  }
}
