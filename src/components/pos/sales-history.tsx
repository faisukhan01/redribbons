"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Printer, ReceiptText, ScrollText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentBadge } from "@/components/pos/shared";
import { Receipt, printReceipt } from "@/components/pos/receipt";
import { ZReportDialog } from "@/components/pos/z-report";
import { api } from "@/lib/api";
import { downloadCSV, todayStamp } from "@/lib/csv";
import { formatDateTime, formatNumber, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/store";
import type { Sale, Stats } from "@/lib/types";

export function SalesHistory() {
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"today" | "all">("today");
  const [receiptSale, setReceiptSale] = useState<Sale | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStats, setReportStats] = useState<Stats | null>(null);
  const userName = useSession((s) => s.user?.name ?? "Staff");

  // Initial load — setState happens in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api<{ sales: Sale[] }>("/api/sales?limit=200")
      .then((data) => {
        if (!cancelled) setSales(data.sales);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unable to load sales history.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    if (filter === "all") return sales ?? [];
    const tzOffset = new Date().getTimezoneOffset();
    const dayStart =
      Math.floor((Date.now() - tzOffset * 60_000) / 86_400_000) * 86_400_000 +
      tzOffset * 60_000;
    return (sales ?? []).filter((s) => new Date(s.createdAt).getTime() >= dayStart);
  }, [sales, filter]);

  const todayTotal = visible.reduce((s, x) => s + x.total, 0);

  function exportCSV() {
    if (visible.length === 0) {
      toast.error("Nothing to export — no sales in the selected filter.");
      return;
    }
    downloadCSV(
      `red-ribbons-sales-${todayStamp()}.csv`,
      ["Sale ID", "Date & Time", "Salesman", "Payment", "Items", "Item Detail", "Total (Rs.)", "Received (Rs.)", "Change (Rs.)"],
      visible.map((s) => [
        s.saleId,
        formatDateTime(s.createdAt),
        s.salesman,
        s.paymentMethod === "CASH" ? "Cash" : "Online",
        s.items.reduce((n, i) => n + i.quantity, 0),
        s.items.map((i) => `${i.quantity}x ${i.name} @ ${i.price}`).join("; "),
        s.total,
        s.amountReceived ?? "",
        s.changeReturned ?? "",
      ])
    );
    toast.success(`Exported ${visible.length} ${visible.length === 1 ? "sale" : "sales"} to CSV.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Sales History</h1>
          <p className="text-sm text-muted-foreground">
            Every transaction with items, payment and change.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!reportStats) {
                const tzOffset = new Date().getTimezoneOffset();
                api<Stats>(`/api/stats?tzOffset=${tzOffset}`)
                  .then(setReportStats)
                  .catch(() => toast.error("Could not load today's report."));
              }
              setReportOpen(true);
            }}
            className="gap-2 border-primary/30 font-bold text-primary hover:bg-primary hover:text-primary-foreground"
          >
            <ScrollText className="h-4 w-4" />
            End-of-Day Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportCSV}
            disabled={sales === null || visible.length === 0}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <div className="flex rounded-lg border bg-card p-1">
            {(["today", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={cn(
                  "rounded-md px-3.5 py-1.5 text-sm font-semibold transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "today" ? "Today" : "All"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      {sales === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <ReceiptText className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            {filter === "today"
              ? "No sales have been recorded today yet."
              : "No sales recorded yet."}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {formatNumber(visible.length)} {visible.length === 1 ? "sale" : "sales"} ·{" "}
            <span className="font-bold text-foreground">{formatPKR(todayTotal)}</span> total
          </p>
          <div className="space-y-3">
            {visible.map((sale) => (
              <div key={sale.id} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <p className="font-mono text-base font-bold text-primary">
                      {sale.saleId}
                    </p>
                    <PaymentBadge method={sale.paymentMethod} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setReceiptSale(sale)}
                      className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-primary"
                      aria-label={`View receipt for ${sale.saleId}`}
                    >
                      <ScrollText className="h-3.5 w-3.5" /> Receipt
                    </button>
                    <p className="text-xl font-bold tabular-nums">{formatPKR(sale.total)}</p>
                  </div>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(sale.createdAt)} · Sold by {sale.salesman}
                </p>

                <div className="mt-3 space-y-1.5 rounded-lg bg-muted/60 p-3">
                  {sale.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold">{item.quantity} ×</span>{" "}
                        {item.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatPKR(item.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>

                {sale.paymentMethod === "CASH" ? (
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      Received:{" "}
                      <span className="font-bold tabular-nums text-foreground">
                        {formatPKR(sale.amountReceived ?? 0)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Change returned:{" "}
                      <span className="font-bold tabular-nums text-foreground">
                        {formatPKR(sale.changeReturned ?? 0)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Paid online — full amount recorded.
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {/* Receipt dialog */}
      <Dialog open={receiptSale !== null} onOpenChange={(v) => !v && setReceiptSale(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              Receipt {receiptSale?.saleId}
            </DialogTitle>
            <DialogDescription>
              Preview the customer receipt or print it for the counter.
            </DialogDescription>
          </DialogHeader>
          {receiptSale ? (
            <>
              <div className="rr-scroll max-h-[55vh] overflow-y-auto rounded-lg bg-muted/50 p-3">
                <Receipt sale={receiptSale} />
              </div>
              <Button
                onClick={() => printReceipt(receiptSale)}
                className="h-11 w-full gap-2 rounded-xl font-bold uppercase tracking-wide"
              >
                <Printer className="h-4 w-4" /> Print Receipt
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* End-of-day report dialog */}
      <ZReportDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        stats={reportStats}
        closedBy={userName}
      />
    </div>
  );
}
