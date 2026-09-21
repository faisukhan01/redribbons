"use client";

import { useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Receipt, printReceipt } from "@/components/pos/receipt";
import { useT } from "@/lib/i18n";
import type { Sale } from "@/lib/types";

/**
 * Reprint the most recent completed receipt. Opened from the POS header
 * ("Last receipt") so the counter can hand a customer a duplicate without
 * digging through the sales history.
 */
export function ReprintDialog({
  open,
  onOpenChange,
  sale,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sale: Sale | null;
}) {
  const { t } = useT();
  const [printing, setPrinting] = useState(false);

  function handlePrint() {
    if (!sale) return;
    setPrinting(true);
    try {
      printReceipt(sale);
    } finally {
      // window.print() blocks until the dialog closes in most browsers
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Printer className="h-5 w-5 text-primary" />
            {t("reprintTitle")}
          </DialogTitle>
          <DialogDescription>
            {sale
              ? `${sale.saleId} · ${sale.items.length} ${sale.items.length === 1 ? "line" : "lines"}`
              : t("reprintEmpty")}
          </DialogDescription>
        </DialogHeader>

        {sale ? (
          <>
            <ScrollArea className="max-h-[55vh] rounded-xl border bg-muted/30 p-3">
              <Receipt sale={sale} className="shadow-none" />
            </ScrollArea>
            <Button
              onClick={handlePrint}
              disabled={printing}
              className="h-11 w-full gap-2 rounded-xl font-bold"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              Print again
            </Button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
