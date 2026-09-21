"use client";

import Image from "next/image";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { cn } from "@/lib/utils";
import { useShopSettings } from "@/lib/settings";
import { formatDateTime, formatPKR } from "@/lib/format";
import type { Sale } from "@/lib/types";

/**
 * Thermal-style receipt (80mm look) for a completed sale.
 * Used on the POS success screen, in the sales-history receipt dialog,
 * and by the print pipeline (printReceipt()).
 */
export function Receipt({ sale, className }: { sale: Sale; className?: string }) {
  const settings = useShopSettings((s) => s.settings);
  const cash = sale.paymentMethod === "CASH";
  const units = sale.items.reduce((s, i) => s + i.quantity, 0);
  const hasDiscount = (sale.discount ?? 0) > 0;
  // Paper roll width — 58 mm compact printers get a narrower receipt
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
          Bakery · Point of Sale
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

      <ReceiptDivider />

      {/* Meta */}
      <div className="space-y-0.5">
        <MetaRow label="Receipt" value={sale.saleId} strong />
        <MetaRow label="Date" value={formatDateTime(sale.createdAt)} />
        <MetaRow label="Served by" value={sale.salesman} />
        <MetaRow label="Payment" value={cash ? "CASH" : "ONLINE"} />
      </div>

      <ReceiptDivider />

      {/* Items */}
      <ul className="space-y-1.5">
        {sale.items.map((item) => (
          <li key={item.id}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                {item.quantity} × {item.name}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {formatPKR(item.subtotal)}
              </span>
            </div>
            {item.quantity > 1 ? (
              <p className="text-[10px] text-muted-foreground">@ {formatPKR(item.price)} each</p>
            ) : null}
          </li>
        ))}
      </ul>

      <ReceiptDivider />

      {/* Totals */}
      <div className="space-y-0.5">
        <MetaRow label={`Items (${units})`} value={formatPKR(sale.items.reduce((s, i) => s + i.subtotal, 0))} />
        {hasDiscount ? (
          <MetaRow label="Discount" value={`− ${formatPKR(sale.discount)}`} />
        ) : null}
        <div className="flex items-baseline justify-between gap-2 text-sm font-bold">
          <span className="uppercase tracking-wider">Total</span>
          <span className="tabular-nums">{formatPKR(sale.total)}</span>
        </div>
        {cash ? (
          <>
            <MetaRow label="Cash received" value={formatPKR(sale.amountReceived ?? 0)} />
            <MetaRow label="Change" value={formatPKR(sale.changeReturned ?? 0)} strong />
          </>
        ) : (
          <MetaRow label="Paid online" value={formatPKR(sale.total)} />
        )}
      </div>

      <ReceiptDivider />

      {/* Footer */}
      <div className="space-y-0.5 text-center text-muted-foreground">
        <p className="text-[11px] font-semibold text-foreground">
          Thank you for shopping with us!
        </p>
        <p className="text-[11px] font-semibold text-foreground" style={{ direction: "rtl" }}>
          شکریہ! دوبارہ تشریف لائیں
        </p>
        <p className="text-[9px] uppercase tracking-[0.25em]">Red Ribbons Bakery</p>
        {settings?.receiptNote ? (
          <p className="text-[9px]">{settings.receiptNote}</p>
        ) : (
          <p className="text-[9px]">Fresh from the oven, every day</p>
        )}
      </div>
    </div>
  );
}

function ReceiptDivider() {
  return (
    <div
      aria-hidden
      className="my-3 border-t border-dashed border-foreground/25"
    />
  );
}

function MetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("shrink-0 tabular-nums", strong ? "font-bold" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}

/**
 * Print a sale receipt: renders the receipt into a dedicated print root,
 * triggers the browser print dialog, then cleans up. All other page content
 * is hidden via the @media print rules in globals.css.
 */
export function printReceipt(sale: Sale) {
  if (typeof window === "undefined") return;
  const host = document.createElement("div");
  host.className = "rr-print-root";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<Receipt sale={sale} />));
    window.print();
  } finally {
    root.unmount();
    host.remove();
  }
}
