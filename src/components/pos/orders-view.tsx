"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  Check,
  CheckCheck,
  ClipboardList,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  ShoppingBag,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OrderFormDialog } from "@/components/pos/order-form-dialog";
import { printOrderMemo } from "@/components/pos/order-memo";
import { api } from "@/lib/api";
import { formatDateTime, formatPKR, formatTime } from "@/lib/format";
import { useCartIntent } from "@/lib/store";
import { useLang, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CartItem, Order, OrderStatus, Product, Role } from "@/lib/types";

/** Human "pickup" label for an order's due time (language-aware). */
function dueLabel(
  dueAt: string | null,
  isUr: boolean,
  tomorrowWord: string
): { text: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);
  const dayAfter = new Date(tomorrowStart);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const overdue = due.getTime() < now.getTime();
  let text: string;
  if (due >= todayStart && due < tomorrowStart)
    text = `${isUr ? "آج" : "Today"} ${formatTime(dueAt)}`;
  else if (due >= tomorrowStart && due < dayAfter)
    text = `${tomorrowWord} ${formatTime(dueAt)}`;
  else text = formatDateTime(dueAt);
  return { text, overdue };
}

/** Normalise a Pakistani phone number for wa.me (03xx… → 923xx…). */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `92${digits.slice(1)}`;
  return digits;
}

/** Pre-filled WhatsApp confirmation message for the customer. */
function waMessage(o: Order, pickupText: string | null): string {
  const lines = o.items
    .map((i) => `${i.quantity}× ${i.name} — ${formatPKR(i.subtotal)}`)
    .join("\n");
  const advance = o.advance > 0;
  return [
    `Red Ribbons Bakery — Pre-order ${o.orderId}`,
    ``,
    `For: ${o.customerName}`,
    ``,
    lines,
    ``,
    `Total: ${formatPKR(o.total)}`,
    advance ? `Advance paid: ${formatPKR(o.advance)}` : "",
    advance ? `Balance at pickup: ${formatPKR(o.total - o.advance)}` : "",
    pickupText ? `Pickup: ${pickupText}` : "",
    ``,
    advance ? "Please bring the balance at pickup. Thank you! 🎀" : "Pay at pickup. Thank you! 🎀",
  ]
    .filter((l) => l !== "")
    .join("\n");
}

export function OrdersView({ role, createdBy, onNavigate }: { role: Role; createdBy: string; onNavigate: (v: "pos") => void }) {
  const { t, isUr } = useT();
  const tomorrowWord = useLang((s) => (s.lang === "ur" ? "کل" : "Tomorrow"));
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"new" | "pickup">("new");
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [advanceTarget, setAdvanceTarget] = useState<Order | null>(null);
  const [advanceInput, setAdvanceInput] = useState("");
  const setIntent = useCartIntent((s) => s.setIntent);

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([
        api<{ orders: Order[] }>("/api/orders?limit=300"),
        api<{ products: Product[] }>("/api/products"),
      ]);
      setOrders(o.orders);
      setProducts(p.products);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("unableLoadOrders"));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { ALL: 0, PENDING: 0, READY: 0, DONE: 0, CANCELLED: 0 };
    for (const o of orders ?? []) {
      c.ALL += 1;
      if (o.status in c) c[o.status as OrderStatus] += 1;
    }
    return c;
  }, [orders]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = (orders ?? []).filter((o) => {
      if (filter !== "ALL" && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.orderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    });
    // "Pickup soon": live orders by earliest dueAt (overdue naturally on top,
    // unscheduled last), closed orders tucked underneath, newest first.
    if (sort === "pickup") {
      const isLive = (o: Order) => o.status === "PENDING" || o.status === "READY";
      const live = list
        .filter(isLive)
        .sort((a, b) => {
          const ta = a.dueAt ? new Date(a.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
          const tb = b.dueAt ? new Date(b.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
          return ta - tb;
        });
      const closed = list.filter((o) => !isLive(o));
      list = [...live, ...closed];
    }
    return list;
  }, [orders, filter, search, sort]);

  async function setStatus(order: Order, status: OrderStatus, okMsg: string) {
    setBusyId(order.id);
    try {
      await api(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(okMsg);
      setOrders((prev) =>
        (prev ?? []).map((o) => (o.id === order.id ? { ...o, status } : o))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("couldNotUpdate"));
    } finally {
      setBusyId(null);
    }
  }

  async function removeOrder(order: Order) {
    setBusyId(order.id);
    try {
      await api(`/api/orders/${order.id}`, { method: "DELETE" });
      toast.success(`${order.orderId} ${t("removedFromBook")}`);
      setOrders((prev) => (prev ?? []).filter((o) => o.id !== order.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("couldNotRemove"));
    } finally {
      setBusyId(null);
      setDeleteTarget(null);
    }
  }

  /** Hand the order's items to the POS cart (stock-clamped) and switch to the counter. */
  function loadIntoPos(order: Order) {
    const items: CartItem[] = [];
    let dropped = 0;
    for (const line of order.items) {
      const live = products.find((p) => p.productId === line.code);
      if (!live || live.stock <= 0) {
        dropped += line.quantity;
        continue;
      }
      const qty = Math.min(line.quantity, live.stock);
      dropped += line.quantity - qty;
      const found = items.find((i) => i.productId === live.id);
      if (found) found.quantity += qty;
      else items.push({ productId: live.id, code: live.productId, name: live.name, price: live.price, stock: live.stock, quantity: qty });
    }
    if (items.length === 0) {
      toast.error(t("nothingInStock"));
      return;
    }
    setIntent(items, order.orderId, order.id);
    onNavigate("pos");
    if (order.advance > 0) {
      const balance = Math.max(0, order.total - order.advance);
      toast.info(
        `${t("balanceDueAtPickupToast")} ${formatPKR(balance)} (${order.orderId})`
      );
    }
    if (dropped > 0) {
      toast.warning(
        isUr
          ? `${order.orderId} ${t("loadedIntoPosToast")} ${dropped} ${t("skippedOutOfStock")}`
          : `${order.orderId} ${t("loadedIntoPosToast")} ${dropped} ${dropped === 1 ? "unit" : t("units")} ${t("skippedOutOfStock")}`
      );
    }
  }

  /** Print the kitchen/booking memo slip for this order. */
  function printMemo(order: Order) {
    printOrderMemo(order);
    toast.success(t("memoPrinted"));
  }

  /** Save an advance (partial payment) against a live order. */
  async function saveAdvance() {
    if (!advanceTarget) return;
    const value = Number(advanceInput);
    if (!Number.isFinite(value) || value < 0) {
      toast.error(t("advanceTooLarge"));
      return;
    }
    if (value > advanceTarget.total) {
      toast.error(t("advanceTooLarge"));
      return;
    }
    const target = advanceTarget;
    setBusyId(target.id);
    try {
      await api(`/api/orders/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ advance: Math.round(value * 100) / 100 }),
      });
      setOrders((prev) =>
        (prev ?? []).map((o) => (o.id === target.id ? { ...o, advance: Math.round(value * 100) / 100 } : o))
      );
      toast.success(
        `${target.orderId} ${t("advanceSavedToast")} ${formatPKR(value)} · ${t("balanceDue")} ${formatPKR(target.total - value)}`
      );
      setAdvanceTarget(null);
      setAdvanceInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("couldNotUpdate"));
    } finally {
      setBusyId(null);
    }
  }

  const statusLabel = (s: OrderStatus): string =>
    s === "PENDING" ? t("stPending") : s === "READY" ? t("stReady") : s === "DONE" ? t("stPickedUp") : t("stCancelled");

  const openCount = counts.PENDING + counts.READY;

  const FILTERS = ["ALL", "PENDING", "READY", "DONE", "CANCELLED"] as const;

  return (
    <div className={cn("space-y-4", isUr && "rr-urdu")}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("preOrdersTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("preOrdersSub")}{" "}
            {openCount > 0 ? (
              <>
                <span className="font-bold text-foreground">{openCount}</span>{" "}
                {t("openOrders")} · {counts.PENDING} {t("pendingWord")}, {counts.READY}{" "}
                {t("readyWord")}
              </>
            ) : (
              t("bookClear")
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={orders === null}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", orders === null && "animate-spin")} />
            {t("refresh")}
          </Button>
          <Button
            onClick={() => setFormOpen(true)}
            className="gap-2 rounded-xl font-bold"
          >
            <Plus className="h-4 w-4" /> {t("newOrder")}
          </Button>
        </div>
      </div>

      {/* Filters + search */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPreOrders")}
              className="sm:max-w-xs"
              aria-label="Search pre-orders"
            />
            <div className="rr-scroll flex gap-1.5 overflow-x-auto pb-0.5">
              {FILTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                    filter === s
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  )}
                >
                  {s === "ALL" ? t("allCaps") : statusLabel(s)}
                  <span className="ml-1.5 tabular-nums opacity-75">{counts[s]}</span>
                </button>
              ))}
            </div>
          </div>
          <div
            className="flex shrink-0 self-start rounded-lg border bg-card p-1 xl:self-auto"
            role="group"
            aria-label="Sort pre-orders"
          >
            {(["new", "pickup"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSort(s)}
                title={s === "new" ? t("sortNewestTitle") : t("sortPickupTitle")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                  sort === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "new" ? t("sortNewest") : t("sortPickup")}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders */}
      {orders === null ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="mt-3 h-6 w-40" />
              <Skeleton className="mt-2 h-4 w-28" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="mt-4 h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 font-semibold">
            {search || filter !== "ALL" ? t("noPreOrdersMatch") : t("noPreOrders")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || filter !== "ALL" ? t("tryDiffSearch") : t("takePhoneOrder")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((o) => {
            const due = dueLabel(o.dueAt, isUr, tomorrowWord);
            const live = o.status === "PENDING" || o.status === "READY";
            const wa = o.customerPhone
              ? `https://wa.me/${waNumber(o.customerPhone)}?text=${encodeURIComponent(waMessage(o, due?.text ?? null))}`
              : null;
            return (
              <article
                key={o.id}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-all hover:shadow-md",
                  o.status === "PENDING" && "border-l-4 border-l-warning",
                  o.status === "READY" && "border-l-4 border-l-[#2E7D4F]",
                  due?.overdue && live && "ring-1 ring-destructive/40"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] font-bold text-muted-foreground">
                        {o.orderId}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          o.status === "PENDING" && "bg-warning text-white",
                          o.status === "READY" && "bg-[#2E7D4F] text-white",
                          o.status === "DONE" && "bg-muted text-muted-foreground",
                          o.status === "CANCELLED" &&
                            "border border-destructive/30 bg-destructive/10 text-destructive"
                        )}
                      >
                        {statusLabel(o.status)}
                      </span>
                      {due ? (
                        <span
                          className={cn(
                            "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
                            due.overdue && live
                              ? "animate-pulse bg-destructive text-white"
                              : !live
                                ? "border bg-muted text-muted-foreground"
                                : "bg-accent text-primary"
                          )}
                        >
                          <AlarmClock className="h-3 w-3" />
                          {due.overdue && live
                            ? isUr
                              ? `${t("overdueWord")} · ${due.text}`
                              : `${t("overdueWord")} · was ${due.text}`
                            : `${t("pickupWord")} ${due.text}`}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 truncate font-display text-lg font-bold leading-tight">
                      {o.customerName}
                    </p>
                    {o.customerPhone ? (
                      <a
                        href={`tel:${o.customerPhone.replace(/\s+/g, "")}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {o.customerPhone}
                      </a>
                    ) : null}
                  </div>
                  <p className="shrink-0 font-display text-xl font-bold tabular-nums text-primary">
                    {formatPKR(o.total)}
                  </p>
                </div>

                {/* Items */}
                <ul className="mt-2.5 space-y-1 border-t pt-2.5">
                  {o.items.map((it, idx) => (
                    <li key={idx} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate">
                        <span className="font-bold tabular-nums">{it.quantity}×</span> {it.name}
                        <span className="ml-1 font-mono text-[11px] text-muted-foreground">{it.code}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatPKR(it.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>

                {o.advance > 0 ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#EAF4EE] px-2.5 py-1 text-[11px] font-bold text-[#2E7D4F]">
                    <Wallet className="h-3 w-3" />
                    {t("advancePaid")} {formatPKR(o.advance)} · {t("balanceDue")} {formatPKR(Math.max(0, o.total - o.advance))}
                  </p>
                ) : null}

                {o.note ? (
                  <p className="mt-2 rounded-lg border border-warning/30 bg-[#FCF7EF] px-2.5 py-1.5 text-xs font-semibold italic text-foreground">
                    “{o.note}”
                  </p>
                ) : null}

                {/* Status progress (booked → ready → picked up) */}
                {o.status !== "CANCELLED" ? (
                  <div
                    className="mt-3 flex items-center gap-1.5"
                    role="img"
                    aria-label={`Progress: ${statusLabel(o.status)}`}
                  >
                    <ProgressDot active title={t("stPending")} />
                    <ProgressBar active />
                    <ProgressDot
                      active={o.status === "READY" || o.status === "DONE"}
                      green
                      title={t("stReady")}
                    />
                    <ProgressBar active={o.status === "DONE"} />
                    <ProgressDot active={o.status === "DONE"} title={t("stPickedUp")} />
                  </div>
                ) : null}

                <p className="mt-2 text-[11px] text-muted-foreground">
                  {t("takenBy")} <span className="font-semibold">{o.createdBy}</span> ·{" "}
                  {formatDateTime(o.createdAt)}
                </p>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                  {o.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() =>
                        void setStatus(o, "READY", `${o.orderId} ${t("markedReady")}`)
                      }
                      className="h-8 gap-1.5 rounded-lg border-[#2E7D4F]/40 text-xs font-bold text-[#2E7D4F] hover:bg-[#2E7D4F] hover:text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> {t("readyBtn")}
                    </Button>
                  ) : null}
                  {o.status === "READY" ? (
                    <Button
                      size="sm"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o, "DONE", `${o.orderId} ${t("pickedUpDone")}`)}
                      className="h-8 gap-1.5 rounded-lg bg-[#2E7D4F] text-xs font-bold text-white hover:bg-[#256B43]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> {t("pickedUpBtn")}
                    </Button>
                  ) : null}
                  {live && role === "SALESMAN" ? (
                    <Button
                      size="sm"
                      onClick={() => loadIntoPos(o)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-bold"
                      title="Load these items into the counter cart"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> {t("loadIntoPos")}
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => printMemo(o)}
                    className="h-8 gap-1.5 rounded-lg text-xs font-bold"
                    title="Print a memo slip for the kitchen / customer"
                  >
                    <Printer className="h-3.5 w-3.5" /> {t("memo")}
                  </Button>
                  {wa ? (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-8 gap-1.5 rounded-lg border-[#2E7D4F]/40 text-xs font-bold text-[#2E7D4F] hover:bg-[#2E7D4F]/10"
                    >
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Send the order summary to the customer on WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </a>
                    </Button>
                  ) : null}
                  {live ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdvanceInput(o.advance > 0 ? String(o.advance) : "");
                        setAdvanceTarget(o);
                      }}
                      className={cn(
                        "h-8 gap-1.5 rounded-lg text-xs font-bold",
                        o.advance > 0 && "border-[#2E7D4F]/40 text-[#2E7D4F] hover:bg-[#2E7D4F]/10"
                      )}
                      title="Record a partial payment for this order"
                    >
                      <Wallet className="h-3.5 w-3.5" /> {t("recordAdvance")}
                    </Button>
                  ) : null}
                  {live ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o, "CANCELLED", `${o.orderId} ${t("cancelledDone")}`)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-bold text-destructive hover:bg-destructive hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" /> {t("cancelBtn")}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === o.id}
                      onClick={() => setDeleteTarget(o)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> {t("removeBtn")}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* New order dialog */}
      {formOpen ? (
        <OrderFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          products={products}
          createdBy={createdBy}
          onCreated={() => void load()}
        />
      ) : null}

      {/* Delete confirmation (closed orders only) */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{`${t("removeBtn")} ${deleteTarget?.orderId}?`}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeOrderDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("keepIt")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && void removeOrder(deleteTarget)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("removeConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Record advance (partial payment) dialog */}
      <Dialog
        open={!!advanceTarget}
        onOpenChange={(v) => {
          if (!v) setAdvanceTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {t("advanceDialogTitle")}
            </DialogTitle>
            <DialogDescription>{t("advanceDialogDesc")}</DialogDescription>
          </DialogHeader>
          {advanceTarget ? (
            <div className={cn("space-y-3", isUr && "rr-urdu")}>
              <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-lg font-bold">{advanceTarget.customerName}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{advanceTarget.orderId}</p>
                </div>
                <p className="shrink-0 text-right font-display text-lg font-bold tabular-nums text-primary">
                  {formatPKR(advanceTarget.total)}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[500, 1000, 2000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    disabled={amt > advanceTarget.total}
                    onClick={() => setAdvanceInput(String(amt))}
                    className="rounded-full border bg-card px-3 py-1.5 text-xs font-bold tabular-nums transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
                  >
                    {formatPKR(amt)}
                  </button>
                ))}
              </div>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  Rs.
                </span>
                <Input
                  value={advanceInput}
                  onChange={(e) => setAdvanceInput(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder={t("advancePh")}
                  inputMode="decimal"
                  aria-label={t("advanceReceived")}
                  className="pl-10 text-right text-lg font-bold tabular-nums"
                  autoFocus
                />
              </div>
              {Number(advanceInput) > advanceTarget.total ? (
                <p className="text-xs font-bold text-destructive">{t("advanceTooLarge")}</p>
              ) : Number(advanceInput) > 0 ? (
                <p className="text-sm font-bold tabular-nums text-[#2E7D4F]">
                  {t("balanceDue")}: {formatPKR(Math.max(0, advanceTarget.total - Number(advanceInput)))}
                </p>
              ) : null}

              <Button
                onClick={() => void saveAdvance()}
                disabled={
                  busyId === advanceTarget.id ||
                  advanceInput.trim() === "" ||
                  !Number.isFinite(Number(advanceInput)) ||
                  Number(advanceInput) < 0 ||
                  Number(advanceInput) > advanceTarget.total
                }
                className="h-11 w-full gap-2 rounded-xl font-bold"
              >
                {busyId === advanceTarget.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wallet className="h-4 w-4" />
                )}
                {t("recordAdvance")}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Small status-progress dot. */
function ProgressDot({ active, green, title }: { active: boolean; green?: boolean; title: string }) {
  return (
    <span
      title={title}
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full transition-colors",
        active
          ? green
            ? "bg-[#2E7D4F]"
            : "bg-primary"
          : "border border-border bg-muted"
      )}
    />
  );
}

/** Connector line between progress dots. */
function ProgressBar({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "h-0.5 flex-1 rounded-full transition-colors",
        active ? "bg-[#2E7D4F]/50" : "bg-border"
      )}
    />
  );
}
