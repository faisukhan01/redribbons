"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, ReceiptText, Store, MapPin, Printer, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useShopSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

/** Owner dialog: shop info that prints on every receipt + the Z-report. */
export function ReceiptSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [paperWidth, setPaperWidth] = useState("80");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      void useShopSettings.getState().load();
      setPhone(useShopSettings.getState().settings?.shopPhone ?? "");
      setAddress(useShopSettings.getState().settings?.shopAddress ?? "");
      setNote(useShopSettings.getState().settings?.receiptNote ?? "");
      setPaperWidth(useShopSettings.getState().settings?.paperWidth === "58" ? "58" : "80");
    }
  }, [open]);

  async function save() {
    setSaving(true);
    try {
      await useShopSettings.getState().save({
        shopPhone: phone,
        shopAddress: address,
        receiptNote: note,
        paperWidth,
      });
      toast.success("Receipt details saved — they will print on every receipt.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Store className="h-5 w-5 text-primary" />
            Receipt Details
          </DialogTitle>
          <DialogDescription>
            These lines print at the top and bottom of every customer receipt and the end-of-day
            report. Leave a field empty to hide it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5">
          <div>
            <label htmlFor="set-phone" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> Phone number
            </label>
            <Input
              id="set-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value.slice(0, 40))}
              placeholder="e.g. 0300 1234567"
              autoComplete="off"
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <label htmlFor="set-address" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Shop address
            </label>
            <Input
              id="set-address"
              value={address}
              onChange={(e) => setAddress(e.target.value.slice(0, 120))}
              placeholder="e.g. Shop 12, Main Bazaar, Lahore"
              autoComplete="off"
              className="mt-1.5 h-11"
            />
          </div>
          <div>
            <label htmlFor="set-note" className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <ReceiptText className="h-3.5 w-3.5" /> Receipt footer note
            </label>
            <Input
              id="set-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
              placeholder="Defaults to “Fresh from the oven, every day”"
              autoComplete="off"
              className="mt-1.5 h-11"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
              <Printer className="h-3.5 w-3.5" /> Receipt paper width
            </label>
            <div
              role="radiogroup"
              aria-label="Receipt paper width"
              className="mt-1.5 grid grid-cols-2 gap-2"
            >
              {[
                { v: "80", title: "Standard 80 mm thermal rolls", hint: "Fits ~32 characters per line" },
                { v: "58", title: "Compact 58 mm thermal rolls", hint: "Fits ~24 characters per line" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  role="radio"
                  aria-checked={paperWidth === opt.v}
                  onClick={() => setPaperWidth(opt.v)}
                  title={opt.title}
                  className={cn(
                    "rounded-xl border-2 p-3 text-left transition-all",
                    paperWidth === opt.v
                      ? "border-primary bg-accent/60 shadow-[0_4px_14px_-8px_rgba(169,26,36,0.5)]"
                      : "border-border bg-card hover:border-primary/40"
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-display text-base font-bold">{opt.v} mm</span>
                    {paperWidth === opt.v ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Match this to your receipt printer&apos;s paper roll — it changes the preview and the
              printed width.
            </p>
          </div>

          {/* Live receipt preview of the lines */}
          <div className="rounded-xl border bg-muted/40 p-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Preview
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {address || "Shop address appears here"}
            </p>
            <p className="text-[11px] font-semibold text-muted-foreground">
              ☎ {phone || "Phone number appears here"}
            </p>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Footer: {note || "Fresh from the oven, every day"}
            </p>
          </div>

          <Button onClick={() => void save()} disabled={saving} className="h-11 w-full gap-2 rounded-xl font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Store className="h-4 w-4" />}
            {saving ? "Saving…" : "Save details"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
