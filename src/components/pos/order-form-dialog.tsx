"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus, Search, Trash2, UserRound } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Order, Product } from "@/lib/types";

interface DraftLine {
  product: Product;
  quantity: number;
}

/** ISO of the next upcoming "hour:00" (today if still ahead, else tomorrow). */
function nextAt(hour: number): string | null {
  const now = new Date();
  for (let add = 0; add <= 1; add++) {
    const d = new Date();
    d.setDate(d.getDate() + add);
    d.setHours(hour, 0, 0, 0);
    if (d.getTime() > now.getTime()) return d.toISOString();
  }
  return null;
}

function toLocalInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OrderFormDialog({
  open,
  onOpenChange,
  products,
  createdBy,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
  createdBy: string;
  onCreated: (order: Order) => void;
}) {
  const { t, isUr } = useT();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState("");
  const [dueInput, setDueInput] = useState("");
  const [advance, setAdvance] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Reset the form whenever the dialog opens
  useEffect(() => {
    if (open) {
      setName("");
      setPhone("");
      setLines([]);
      setSearch("");
      setDueInput("");
      setAdvance("");
      setNote("");
      // focus the first field once mounted
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [open]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 6);
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q))
      .slice(0, 6);
  }, [search, products]);

  const total = lines.reduce((s, l) => s + l.product.price * l.quantity, 0);

  // Advance (partial payment) — clamped against the live total; only a
  // positive, finite number counts. Wrong input falls back to 0 at save time.
  const advanceNum = Number(advance);
  const advanceValid = advance.trim() === "" || (Number.isFinite(advanceNum) && advanceNum >= 0);
  const advanceValue = advanceValid && advanceNum > 0 ? Math.min(advanceNum, total) : 0;
  const balance = Math.max(0, total - advanceValue);

  function addLine(p: Product) {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, quantity: Math.min(999, l.quantity + 1) } : l
        );
      }
      return [...prev, { product: p, quantity: 1 }];
    });
  }

  function setQty(productId: number, qty: number) {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== productId)
        : prev.map((l) => (l.product.id === productId ? { ...l, quantity: Math.min(999, qty) } : l))
    );
  }

  /** Compute the final dueAt ISO from the datetime input. */
  function resolveDueAt(): string | null {
    if (!dueInput) return null;
    const d = new Date(dueInput);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function save() {
    if (!name.trim()) {
      toast.error(t("customerNameRequired"));
      return;
    }
    if (lines.length === 0) {
      toast.error(t("addOneItem"));
      return;
    }
    if (!advanceValid) {
      toast.error(t("advanceTooLarge"));
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ order: Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          items: lines.map((l) => ({ code: l.product.productId, quantity: l.quantity })),
          dueAt: resolveDueAt(),
          advance: advanceValue > 0 ? advanceValue : undefined,
          note,
          createdBy,
        }),
      });
      toast.success(
        isUr
          ? `${res.order.orderId} ${t("orderSaved")} ${res.order.customerName}`
          : `Pre-order ${res.order.orderId} ${t("orderSaved")} ${res.order.customerName}.`
      );
      onCreated(res.order);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("couldNotSave"));
    } finally {
      setSaving(false);
    }
  }

  const dueChips: Array<{ label: string; iso: string | null }> = [
    { label: t("chipToday5"), iso: nextAt(17) },
    { label: t("chipTom12"), iso: nextAt(12) },
    { label: t("chipTom5"), iso: nextAt(17) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rr-scroll max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t("nfTitle")}</DialogTitle>
          <DialogDescription>{t("nfDesc")}</DialogDescription>
        </DialogHeader>

        <div className={cn("space-y-4", isUr && "rr-urdu")}>
          {/* Customer */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="order-name" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t("customerName")}
              </label>
              <Input
                id="order-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePh")}
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="order-phone" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {t("phone")}
              </label>
              <Input
                id="order-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="03xx xxxxxxx"
                inputMode="tel"
                maxLength={20}
              />
            </div>
          </div>

          {/* Items picker */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("itemsLabel")}
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchProductsPh")}
                className="pl-9"
                aria-label="Search products for the pre-order"
              />
            </div>
            <div className="rr-scroll flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted/30 p-1.5">
              {matches.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">{t("noProductsMatch2")}</p>
              ) : (
                matches.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLine(p)}
                    className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 truncate text-sm font-semibold">{p.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      <span className="font-mono">{p.productId}</span> · {formatPKR(p.price)}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Draft lines */}
            {lines.length > 0 ? (
              <div className="space-y-1.5">
                {lines.map((l) => (
                  <div
                    key={l.product.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-l-4 border-l-primary bg-accent/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{l.product.name}</p>
                      <p className="text-[11px] tabular-nums text-muted-foreground">
                        {formatPKR(l.product.price)} {t("each")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <div className="flex items-center rounded-lg border bg-card">
                        <button
                          type="button"
                          onClick={() => setQty(l.product.id, l.quantity - 1)}
                          className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={`Decrease ${l.product.name}`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold tabular-nums">
                          {l.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(l.product.id, l.quantity + 1)}
                          className="flex h-8 w-8 items-center justify-center text-muted-foreground hover:text-foreground"
                          aria-label={`Increase ${l.product.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <span className="w-20 text-right text-sm font-bold tabular-nums text-primary">
                        {formatPKR(l.product.price * l.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQty(l.product.id, 0)}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${l.product.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Pickup time */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("pickupTime")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {dueChips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  disabled={!c.iso}
                  onClick={() => c.iso && setDueInput(toLocalInputValue(c.iso))}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
                >
                  {c.label}
                </button>
              ))}
              {dueInput ? (
                <button
                  type="button"
                  onClick={() => setDueInput("")}
                  className="rounded-full border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
                >
                  {t("clearTime")}
                </button>
              ) : null}
            </div>
            <Input
              type="datetime-local"
              value={dueInput}
              onChange={(e) => setDueInput(e.target.value)}
              aria-label="Pickup date and time"
              className="text-sm"
            />
          </div>

          {/* Advance (partial payment) */}
          <div className="space-y-2">
            <label
              htmlFor="order-advance"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              {t("advanceReceived")}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {[500, 1000, 2000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAdvance(String(amt))}
                  className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold tabular-nums transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {formatPKR(amt)}
                </button>
              ))}
              {advance ? (
                <button
                  type="button"
                  onClick={() => setAdvance("")}
                  className="rounded-full border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-bold text-destructive transition-colors hover:bg-destructive/10"
                >
                  {t("clearAdvance")}
                </button>
              ) : null}
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                Rs.
              </span>
              <Input
                id="order-advance"
                value={advance}
                onChange={(e) => setAdvance(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder={t("advancePh")}
                inputMode="decimal"
                className={cn("pl-10 text-right font-bold tabular-nums", !advanceValid && "border-destructive")}
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="order-note" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {t("note")}
            </label>
            <Textarea
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("notePh")}
              rows={2}
              maxLength={300}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("orderTotal")}
              </p>
              <p className="font-display text-xl font-bold tabular-nums text-primary">
                {formatPKR(total)}
              </p>
              {advanceValue > 0 ? (
                <p className="mt-0.5 text-[11px] font-bold tabular-nums text-[#2E7D4F]">
                  {t("advancePaid")} {formatPKR(advanceValue)} · {t("balanceDue")} {formatPKR(balance)}
                </p>
              ) : null}
            </div>
            <Button
              onClick={() => void save()}
              disabled={saving || lines.length === 0 || !name.trim()}
              className="h-11 gap-2 rounded-xl px-6 font-bold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
              {saving ? t("saving") : t("saveOrder")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
