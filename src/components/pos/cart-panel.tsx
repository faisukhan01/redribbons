"use client";

import {
  Banknote,
  Loader2,
  Minus,
  PackageOpen,
  Pause,
  Play,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatNumber, formatPKR, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { HeldSale } from "@/lib/store";
import type { CartItem } from "@/lib/types";

export type PayMethod = "CASH" | "ONLINE";

interface CartPanelProps {
  cart: CartItem[];
  total: number;
  paymentMethod: PayMethod;
  onPaymentMethod: (m: PayMethod) => void;
  cashInput: string;
  onCashInput: (v: string) => void;
  received: number;
  change: number;
  completing: boolean;
  held: HeldSale[];
  onHold: () => void;
  onResume: (id: string) => void;
  onDiscard: (id: string) => void;
  onSetQty: (productId: number, qty: number) => void;
  onRemove: (productId: number) => void;
  onClear: () => void;
  onComplete: () => void;
}

function sanitizeCash(v: string): string {
  const cleaned = v.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : cleaned;
}

export function CartPanel({
  cart,
  total,
  paymentMethod,
  onPaymentMethod,
  cashInput,
  onCashInput,
  received,
  change,
  completing,
  held,
  onHold,
  onResume,
  onDiscard,
  onSetQty,
  onRemove,
  onClear,
  onComplete,
}: CartPanelProps) {
  const empty = cart.length === 0;
  const cashOk = received >= total;
  const insufficient = received > 0 && !cashOk;
  const canComplete = !empty && (paymentMethod === "ONLINE" || cashOk) && !completing;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold">Current Sale</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-secondary-foreground">
            {cart.reduce((s, i) => s + i.quantity, 0)}{" "}
            {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? "item" : "items"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onHold}
            disabled={empty}
            title="Park this order and start the next customer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-warning/10 hover:text-warning disabled:opacity-40"
          >
            <Pause className="h-3.5 w-3.5" /> Hold
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={empty}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>
        </div>
      </div>

      {/* Parked sales */}
      {held.length > 0 ? (
        <div className="mt-3 rounded-lg border border-warning/30 bg-[#FCF7EF] p-2">
          <p className="px-1 text-[11px] font-bold uppercase tracking-wide text-warning">
            Parked orders ({formatNumber(held.length)})
          </p>
          <div className="rr-scroll mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
            {held.map((h) => (
              <div
                key={h.id}
                className="group flex shrink-0 items-center gap-1.5 rounded-lg border border-warning/25 bg-card py-1 pl-2.5 pr-1 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onResume(h.id)}
                  title="Resume this order"
                  className="flex items-center gap-1.5 text-left"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-warning/15 text-warning">
                    <Play className="h-3 w-3" />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-xs font-bold tabular-nums text-foreground">
                      {formatPKR(h.total)}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {h.items.reduce((s, i) => s + i.quantity, 0)} items · {formatTime(h.at)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDiscard(h.id)}
                  aria-label="Discard parked order"
                  className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Cart items */}
      <div className="rr-scroll max-h-[30vh] min-h-[80px] overflow-y-auto py-2 lg:max-h-[32vh]">
        {empty ? (
          <div className="flex h-full min-h-[96px] flex-col items-center justify-center py-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent">
              <PackageOpen className="h-5 w-5 text-primary/70" />
            </span>
            <p className="mt-2.5 text-sm font-semibold text-foreground">Cart is empty</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Enter a Product ID or tap a product tile to start
            </p>
          </div>
        ) : (
          <ul className="divide-y">
            {cart.map((item) => (
              <li key={item.productId} className="py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-mono">{item.code}</span> · {formatPKR(item.price)} each
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tabular-nums">
                      {formatPKR(item.price * item.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemove(item.productId)}
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${item.name}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex items-center rounded-lg border">
                    <button
                      type="button"
                      onClick={() => onSetQty(item.productId, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-30"
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-9 text-center text-sm font-bold tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSetQty(item.productId, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {item.quantity >= item.stock ? (
                    <span className="text-[11px] font-semibold text-warning">
                      Max stock ({item.stock})
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between border-t pt-3">
        <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <span className="font-display text-2xl font-bold tabular-nums text-primary">
          {formatPKR(total)}
        </span>
      </div>

      {/* Payment */}
      <div className={cn("mt-3 space-y-3", empty && "pointer-events-none opacity-40")}>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onPaymentMethod("CASH")}
            aria-pressed={paymentMethod === "CASH"}
            className={cn(
              "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-bold uppercase tracking-wide transition-all",
              paymentMethod === "CASH"
                ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_rgba(169,26,36,0.55)]"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <Banknote className="h-5 w-5" /> Cash
          </button>
          <button
            type="button"
            onClick={() => onPaymentMethod("ONLINE")}
            aria-pressed={paymentMethod === "ONLINE"}
            className={cn(
              "flex min-h-[48px] items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-bold uppercase tracking-wide transition-all",
              paymentMethod === "ONLINE"
                ? "border-primary bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_rgba(169,26,36,0.55)]"
                : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            <Smartphone className="h-5 w-5" /> Online
          </button>
        </div>

        {paymentMethod === "CASH" ? (
          <div className="space-y-2 rounded-xl bg-muted/50 p-3">
            <label
              htmlFor="cash-input"
              className="text-xs font-bold uppercase tracking-wide text-muted-foreground"
            >
              Customer Gives
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-muted-foreground">
                Rs.
              </span>
              <input
                id="cash-input"
                type="text"
                inputMode="decimal"
                value={cashInput}
                onChange={(e) => onCashInput(sanitizeCash(e.target.value))}
                placeholder="0"
                disabled={empty}
                className="h-12 w-full rounded-lg border bg-card pl-12 pr-3 text-right text-xl font-bold tabular-nums outline-none ring-primary focus:ring-2 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[500, 1000, 2000, 5000].map((v) => (
                <button
                  key={v}
                  type="button"
                  disabled={empty}
                  onClick={() => onCashInput(String(v))}
                  className="rounded-full border bg-card px-3 py-1 text-xs font-bold tabular-nums text-foreground transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-40"
                >
                  {v.toLocaleString()}
                </button>
              ))}
              <button
                type="button"
                disabled={empty}
                onClick={() => onCashInput(String(total))}
                className="rounded-full border border-primary/40 bg-accent px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:opacity-40"
              >
                Exact
              </button>
            </div>

            <div className="flex items-center justify-between rounded-lg px-1 pt-1">
              {cashInput === "" ? (
                <p className="text-xs text-muted-foreground">Enter amount to calculate change</p>
              ) : cashOk ? (
                <>
                  <span className="text-sm font-bold uppercase tracking-wide text-[#2E7D4F]">
                    Change
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-[#2E7D4F]">
                    {formatPKR(change)}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-bold uppercase tracking-wide text-destructive">
                    Insufficient payment
                  </span>
                  <span className="text-lg font-bold tabular-nums text-destructive">
                    Remaining {formatPKR(total - received)}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 p-3">
            <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              The customer pays by <span className="font-bold text-foreground">Online</span>{" "}
              transfer. The full amount of{" "}
              <span className="font-bold text-foreground">{formatPKR(total)}</span> will be
              recorded — no change needed.
            </p>
          </div>
        )}
      </div>

      {/* Complete */}
      <Button
        size="lg"
        onClick={onComplete}
        disabled={!canComplete}
        className="mt-3 h-14 w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-[#8E1620] text-base font-bold uppercase tracking-wide shadow-[0_10px_24px_-10px_rgba(169,26,36,0.6)] transition-shadow hover:shadow-[0_12px_28px_-10px_rgba(169,26,36,0.7)]"
      >
        {completing ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {completing ? "Completing…" : `Complete Sale · ${formatPKR(total)}`}
      </Button>
      {insufficient ? (
        <p className="mt-2 text-center text-xs font-semibold text-destructive">
          Payment amount is insufficient — collect the remaining {formatPKR(total - received)} to
          complete the sale.
        </p>
      ) : null}
    </div>
  );
}
