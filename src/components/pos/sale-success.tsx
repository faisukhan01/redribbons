"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, CheckCheck, Loader2, Printer, Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Receipt, printReceipt } from "@/components/pos/receipt";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
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

export function SaleSuccess({
  sale,
  orderLink,
  onNewSale,
}: {
  sale: Sale;
  /** Pre-order this sale was loaded from (via "Load into POS"), if any. */
  orderLink?: { id: number; label: string } | null;
  onNewSale: () => void;
}) {
  const [printing, setPrinting] = useState(false);
  const [markingUp, setMarkingUp] = useState(false);
  const [pickedUp, setPickedUp] = useState(false);
  const { t } = useT();

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

  /** Close the loop on a pre-order picked up at the counter. */
  async function markOrderPickedUp() {
    if (!orderLink) return;
    setMarkingUp(true);
    try {
      await api(`/api/orders/${orderLink.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "DONE" }),
      });
      setPickedUp(true);
      toast.success(`${orderLink.label} ${t("pickedUpDone")}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setMarkingUp(false);
    }
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
      <h1 className="mt-5 font-display text-3xl font-bold">{t("saleComplete")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("thanksRecorded")}
      </p>

      {/* Pre-order pickup prompt — closes the book on this order */}
      {orderLink ? (
        <div className="rr-pop mt-5 w-full rounded-xl border border-[#2E7D4F]/30 bg-[#EAF4EE]/50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#2E7D4F]">
            {t("fromPreOrder")}
          </p>
          <p className="mt-1 font-mono text-base font-bold text-foreground">{orderLink.label}</p>
          {pickedUp ? (
            <p className="mt-2.5 flex items-center justify-center gap-1.5 text-sm font-bold text-[#2E7D4F]">
              <CheckCheck className="h-4 w-4" />
              {t("pickedUpDoneLabel")}
            </p>
          ) : (
            <Button
              onClick={() => void markOrderPickedUp()}
              disabled={markingUp}
              className="mt-2.5 h-11 w-full gap-2 rounded-xl bg-[#2E7D4F] font-bold text-white hover:bg-[#256B43]"
            >
              {markingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {t("markPickedUpBtn")}
            </Button>
          )}
        </div>
      ) : null}

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
          {printing ? t("preparing") : t("printReceipt")}
        </Button>
        <Button
          size="lg"
          onClick={onNewSale}
          className="h-14 rounded-xl bg-gradient-to-r from-primary to-[#8E1620] text-base font-bold uppercase tracking-wide shadow-[0_10px_24px_-10px_rgba(169,26,36,0.6)] transition-all active:scale-[0.99]"
        >
          {t("newSale")}
        </Button>
        <p className="col-span-full text-[11px] font-semibold text-muted-foreground">
          Tip: press <span className="rounded border bg-muted px-1 py-0.5 font-sans">Enter</span> to
          start the next sale
        </p>
      </div>
    </div>
  );
}
