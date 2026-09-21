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
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [search, setSearch] = useState("");
  const [dueInput, setDueInput] = useState("");
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
      toast.error("Customer name is required.");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one item to the order.");
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
          note,
          createdBy,
        }),
      });
      toast.success(`Pre-order ${res.order.orderId} saved for ${res.order.customerName}.`);
      onCreated(res.order);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the pre-order.");
    } finally {
      setSaving(false);
    }
  }

  const dueChips: Array<{ label: string; iso: string | null }> = [
    { label: "Today 5 PM", iso: nextAt(17) },
    { label: "Tomorrow 12 PM", iso: nextAt(12) },
    { label: "Tomorrow 5 PM", iso: nextAt(17) },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rr-scroll max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">New pre-order</DialogTitle>
          <DialogDescription>
            Book items for a customer to pick up later — nothing leaves stock until the sale is
            completed at the counter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer */}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="order-name" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Customer name *
              </label>
              <Input
                id="order-name"
                ref={nameRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ali Raza"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="order-phone" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Phone
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
              Items
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by product name or ID…"
                className="pl-9"
                aria-label="Search products for the pre-order"
              />
            </div>
            <div className="rr-scroll flex max-h-36 flex-col gap-1 overflow-y-auto rounded-lg border bg-muted/30 p-1.5">
              {matches.length === 0 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">No products match.</p>
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
                        {formatPKR(l.product.price)} each
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
              Pickup time
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
                  Clear time
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

          {/* Note */}
          <div className="space-y-1.5">
            <label htmlFor="order-note" className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Note
            </label>
            <Textarea
              id="order-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Write “Happy Birthday Ayesha” on the cake"
              rows={2}
              maxLength={300}
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Order total
              </p>
              <p className="font-display text-xl font-bold tabular-nums text-primary">
                {formatPKR(total)}
              </p>
            </div>
            <Button
              onClick={() => void save()}
              disabled={saving || lines.length === 0 || !name.trim()}
              className="h-11 gap-2 rounded-xl px-6 font-bold"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRound className="h-4 w-4" />}
              {saving ? "Saving…" : "Save order"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
