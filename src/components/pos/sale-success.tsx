"use client";

import { useState } from "react";
import { CheckCircle2, Printer, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Receipt, printReceipt } from "@/components/pos/receipt";
import { formatPKR } from "@/lib/format";
import type { Sale } from "@/lib/types";

export function SaleSuccess({ sale, onNewSale }: { sale: Sale; onNewSale: () => void }) {
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    setPrinting(true);
    // let the button paint its busy state before the (blocking) print dialog opens
    setTimeout(() => {
      try {
        printReceipt(sale);
      } finally {
        setPrinting(false);
      }
    }, 50);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-6 text-center sm:py-10">
      <div className="rr-pop flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF4EE]">
        <CheckCircle2 className="h-11 w-11 text-[#2E7D4F]" />
      </div>
      <h1 className="mt-5 font-display text-3xl font-bold">Sale Completed</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Thank you — the transaction has been recorded.
      </p>

      {/* Receipt preview with a playful tear-here line */}
      <div className="mt-6 w-full">
        <div aria-hidden className="mx-auto mb-3 flex max-w-[300px] items-center gap-2">
          <div className="h-px flex-1 border-t border-dashed border-foreground/25" />
          <Scissors className="h-3.5 w-3.5 -scale-x-100 text-muted-foreground/50" />
          <div className="h-px flex-1 border-t border-dashed border-foreground/25" />
        </div>
        <Receipt sale={sale} className="shadow-md" />
      </div>

      <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Button
          variant="outline"
          onClick={handlePrint}
          disabled={printing}
          className="h-14 gap-2 rounded-xl text-sm font-bold uppercase tracking-wide"
        >
          <Printer className="h-5 w-5" />
          {printing ? "Preparing…" : "Print Receipt"}
        </Button>
        <Button
          size="lg"
          onClick={onNewSale}
          className="h-14 rounded-xl bg-gradient-to-r from-primary to-[#8E1620] text-base font-bold uppercase tracking-wide shadow-[0_10px_24px_-10px_rgba(169,26,36,0.6)]"
        >
          New Sale
        </Button>
      </div>
    </div>
  );
}
