"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Printer, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Receipt, printReceipt } from "@/components/pos/receipt";
import { formatPKR } from "@/lib/format";
import type { Sale } from "@/lib/types";

/* Brand ribbon pieces — deterministic so the DOM stays stable between renders. */
const RIBBONS = [
  { left: "8%", delay: "0s", color: "#A91A24" },
  { left: "18%", delay: "0.25s", color: "#7A0F15" },
  { left: "30%", delay: "0.55s", color: "#D9A441" },
  { left: "42%", delay: "0.12s", color: "#A91A24" },
  { left: "55%", delay: "0.4s", color: "#7A0F15" },
  { left: "66%", delay: "0.05s", color: "#D9A441" },
  { left: "78%", delay: "0.32s", color: "#A91A24" },
  { left: "90%", delay: "0.5s", color: "#7A0F15" },
];

export function SaleSuccess({ sale, onNewSale }: { sale: Sale; onNewSale: () => void }) {
  const [printing, setPrinting] = useState(false);

  // Enter starts the next sale from the success screen (counter speed)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" && !(e.target as HTMLElement | null)?.closest("button")) {
        e.preventDefault();
        onNewSale();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNewSale]);

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
    <div className="relative mx-auto flex max-w-md flex-col items-center py-6 text-center sm:py-10">
      {/* Ribbon confetti (aria-hidden, behind the check) */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden">
        {RIBBONS.map((r, i) => (
          <span
            key={i}
            className="rr-ribbon"
            style={{ left: r.left, animationDelay: r.delay, backgroundColor: r.color }}
          />
        ))}
      </div>

      <div className="rr-pop relative flex h-20 w-20 items-center justify-center rounded-full bg-[#EAF4EE]">
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
        <p className="col-span-full text-[11px] font-semibold text-muted-foreground">
          Tip: press <span className="rounded border bg-muted px-1 py-0.5 font-sans">Enter</span> to
          start the next sale
        </p>
      </div>
    </div>
  );
}
