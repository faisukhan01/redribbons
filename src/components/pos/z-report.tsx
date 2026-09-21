"use client";

import Image from "next/image";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime, formatNumber, formatPKR } from "@/lib/format";
import { useShopSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import type { Stats } from "@/lib/types";

/**
 * End-of-day (Z) report — thermal-style daily closing summary.
 * Rendered inside a preview dialog and by printZReport() via the
 * dedicated print root (see @media print rules in globals.css).
 */
export function ZReport({ stats, closedBy }: { stats: Stats; closedBy: string }) {
  const { report } = stats;
  const settings = useShopSettings((s) => s.settings);
  const hasSales = stats.salesTodayCount > 0;

  return (
    <div className="rr-receipt mx-auto w-full max-w-[300px] bg-white px-5 py-6 text-[11px] leading-relaxed text-foreground shadow-sm ring-1 ring-black/5">
      {/* Brand header */}
      <div className="flex flex-col items-center text-center">
        <Image src="/logo-mark.png" alt="" width={1011} height={975} className="h-12 w-auto" />
        <p className="mt-1.5 font-display text-lg font-bold tracking-wide text-primary">
          RED RIBBONS
        </p>
        <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Bakery · Point of Sale
        </p>
        {settings?.shopPhone ? (
          <p className="mt-1 text-[10px] text-muted-foreground">☎ {settings.shopPhone}</p>
        ) : null}
        <p className="mt-2.5 inline-block rounded border border-dashed border-foreground/40 px-3 py-1 font-display text-sm font-bold uppercase tracking-[0.2em]">
          End of Day Report
        </p>
      </div>

      <ZDivider />

      {/* Meta */}
      <div className="space-y-0.5">
        <ZRow label="Business date" value={formatDateTime(new Date().toISOString())} />
        <ZRow label="Closed by" value={closedBy} />
      </div>

      <ZDivider />

      {/* Headline totals */}
      <div className="text-center">
        <p className="text-[9px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Gross sales today
        </p>
        <p className="font-display text-2xl font-bold tabular-nums text-primary">
          {formatPKR(stats.todaySales)}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {formatNumber(stats.salesTodayCount)}{" "}
          {stats.salesTodayCount === 1 ? "transaction" : "transactions"} ·{" "}
          {formatNumber(stats.itemsSoldToday)} {stats.itemsSoldToday === 1 ? "item" : "items"} sold
        </p>
      </div>

      <ZDivider />

      {/* Payment breakdown */}
      <div className="space-y-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Payment summary
        </p>
        <ZRow label="Cash collected" value={formatPKR(stats.cashToday)} strong />
        <ZRow label="─ Cash transactions" value={String(report.cashCount)} muted />
        <ZRow label="Online collected" value={formatPKR(stats.onlineToday)} strong />
        <ZRow label="─ Online transactions" value={String(report.onlineCount)} muted />
        {report.discountTotal > 0 ? (
          <ZRow label="Discounts given" value={`− ${formatPKR(report.discountTotal)}`} />
        ) : null}
        <ZRow label="Change given" value={formatPKR(report.changeGiven)} />
        <div className="flex items-baseline justify-between gap-2 border-t border-dashed border-foreground/25 pt-1 text-sm font-bold">
          <span className="uppercase tracking-wider">Net drawer (cash)</span>
          <span className="tabular-nums">{formatPKR(stats.cashToday - report.changeGiven)}</span>
        </div>
      </div>

      <ZDivider />

      {/* Top items today */}
      {hasSales ? (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Top items today
          </p>
          {report.topItems.length === 0 ? (
            <p className="text-muted-foreground">No item detail available.</p>
          ) : (
            report.topItems.map((it, i) => (
              <div key={it.name} className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate">
                  {i + 1}. {it.name}
                  <span className="text-muted-foreground"> × {it.quantity}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatPKR(it.revenue)}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <p className="text-center text-muted-foreground">No sales recorded today.</p>
      )}

      <ZDivider />

      {/* Staff sales today */}
      {stats.staffToday.length > 1 ? (
        <div className="space-y-0.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Staff sales today
          </p>
          {stats.staffToday.map((s) => (
            <ZRow
              key={s.salesman}
              label={`${s.salesman} — ${formatNumber(s.count)} ${s.count === 1 ? "sale" : "sales"}`}
              value={formatPKR(s.total)}
            />
          ))}
        </div>
      ) : null}

      {stats.staffToday.length > 1 ? <ZDivider /> : null}

      {/* Stock note */}
      <ZRow
        label="Products needing restock"
        value={
          stats.lowStock.length > 0
            ? `${stats.lowStock.length} low / out`
            : "None — all good"
        }
        strong={stats.lowStock.length > 0}
      />

      <ZDivider />

      {/* Footer */}
      <div className="space-y-0.5 text-center text-muted-foreground">
        <p className="text-[11px] font-semibold text-foreground">End of day — counted &amp; closed</p>
        <p className="text-[9px] uppercase tracking-[0.25em]">Red Ribbons Bakery</p>
        <p className="text-[9px]">Keep this report with the cash drawer</p>
      </div>
    </div>
  );
}

function ZDivider() {
  return <div aria-hidden className="my-3 border-t border-dashed border-foreground/25" />;
}

function ZRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className={cn(muted ? "text-muted-foreground" : "text-foreground")}>{label}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          strong ? "font-bold" : muted ? "font-medium text-muted-foreground" : "font-medium"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Render the Z-report into the print root and open the browser print dialog. */
export function printZReport(stats: Stats, closedBy: string) {
  if (typeof window === "undefined") return;
  const host = document.createElement("div");
  host.className = "rr-print-root";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(<ZReport stats={stats} closedBy={closedBy} />));
    window.print();
  } finally {
    root.unmount();
    host.remove();
  }
}

/** Dialog with an on-screen preview of the report + print action. */
export function ZReportDialog({
  open,
  onOpenChange,
  stats,
  closedBy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: Stats | null;
  closedBy: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">End-of-Day Report</DialogTitle>
          <DialogDescription>
            Today&apos;s closing summary — print it and keep it with the drawer.
          </DialogDescription>
        </DialogHeader>
        {stats ? (
          <>
            <ZReport stats={stats} closedBy={closedBy} />
            <PrintButton stats={stats} closedBy={closedBy} />
          </>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading report…</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PrintButton({ stats, closedBy }: { stats: Stats; closedBy: string }) {
  return (
    <Button
      onClick={() => {
        // let the click paint before the blocking print dialog opens
        setTimeout(() => printZReport(stats, closedBy), 50);
      }}
      className="h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-[#8E1620] font-bold uppercase tracking-wide shadow-[0_10px_24px_-10px_rgba(169,26,36,0.6)]"
    >
      <Printer className="h-4 w-4" />
      Print report
    </Button>
  );
}


