"use client";

import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatPKR } from "@/lib/format";
import type { Sale } from "@/lib/types";

export function SaleSuccess({ sale, onNewSale }: { sale: Sale; onNewSale: () => void }) {
  const rows: Array<[string, string]> = [
    ["Sale ID", sale.saleId],
    ["Total", formatPKR(sale.total)],
    ["Payment", sale.paymentMethod === "CASH" ? "Cash" : "Online"],
  ];
  if (sale.paymentMethod === "CASH") {
    rows.push(["Received", formatPKR(sale.amountReceived ?? 0)]);
    rows.push(["Change", formatPKR(sale.changeReturned ?? 0)]);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-8 text-center sm:py-14">
      <div className="rr-pop flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF4EE]">
        <CheckCircle2 className="h-11 w-11 text-[#2E7D4F]" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold">Sale Completed</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Thank you — the transaction has been recorded.
      </p>

      <div className="mt-6 w-full rounded-2xl border bg-card p-5 text-left shadow-sm">
        <dl className="divide-y">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
              <dd
                className={
                  label === "Sale ID"
                    ? "font-mono text-lg font-bold text-primary"
                    : "text-base font-bold tabular-nums"
                }
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 rounded-lg bg-muted/60 p-3">
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Items
          </p>
          {sale.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-3 py-0.5 text-sm">
              <span>
                <span className="font-semibold">{i.quantity} ×</span> {i.name}
              </span>
              <span className="tabular-nums text-muted-foreground">{formatPKR(i.subtotal)}</span>
            </div>
          ))}
        </div>
      </div>

      <Button size="lg" onClick={onNewSale} className="mt-6 h-14 w-full rounded-xl text-base font-bold uppercase tracking-wide sm:w-64">
        New Sale
      </Button>
    </div>
  );
}
