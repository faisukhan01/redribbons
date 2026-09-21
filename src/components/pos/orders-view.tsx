"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlarmClock,
  Check,
  CheckCheck,
  ClipboardList,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  ShoppingBag,
  Trash2,
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
import { OrderFormDialog } from "@/components/pos/order-form-dialog";
import { api } from "@/lib/api";
import { formatDateTime, formatPKR, formatTime } from "@/lib/format";
import { useCartIntent } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CartItem, Order, OrderStatus, Product, Role } from "@/lib/types";

const STATUS_META: Record<OrderStatus, { label: string; cls: string }> = {
  PENDING: { label: "Pending", cls: "bg-warning text-white" },
  READY: { label: "Ready", cls: "bg-[#2E7D4F] text-white" },
  DONE: { label: "Picked up", cls: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Cancelled", cls: "bg-destructive/10 text-destructive border border-destructive/30" },
};

/** Human "pickup" label for an order's due time. */
function dueLabel(dueAt: string | null): { text: string; overdue: boolean } | null {
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
  if (due >= todayStart && due < tomorrowStart) text = `Today ${formatTime(dueAt)}`;
  else if (due >= tomorrowStart && due < dayAfter) text = `Tomorrow ${formatTime(dueAt)}`;
  else text = formatDateTime(dueAt);
  return { text, overdue };
}

export function OrdersView({ role, createdBy, onNavigate }: { role: Role; createdBy: string; onNavigate: (v: "pos") => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
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
      toast.error(err instanceof Error ? err.message : "Unable to load pre-orders.");
    }
  }, []);

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
    return (orders ?? []).filter((o) => {
      if (filter !== "ALL" && o.status !== filter) return false;
      if (!q) return true;
      return (
        o.orderId.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q)
      );
    });
  }, [orders, filter, search]);

  async function setStatus(order: Order, status: OrderStatus, okMsg: string) {
    setBusyId(order.id);
    try {
      await api(`/api/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(okMsg);
      setOrders((prev) =>
        (prev ?? []).map((o) => (o.id === order.id ? { ...o, status } : o))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeOrder(order: Order) {
    setBusyId(order.id);
    try {
      await api(`/api/orders/${order.id}`, { method: "DELETE" });
      toast.success(`Order ${order.orderId} removed from the book.`);
      setOrders((prev) => (prev ?? []).filter((o) => o.id !== order.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the order.");
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
      toast.error("Nothing from this order is in stock right now.");
      return;
    }
    setIntent(items, order.orderId);
    onNavigate("pos");
    if (dropped > 0) {
      toast.warning(
        `${order.orderId} loaded — ${dropped} ${dropped === 1 ? "unit" : "units"} skipped (out of stock).`
      );
    }
  }

  const openCount = counts.PENDING + counts.READY;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Pre-orders</h1>
          <p className="text-sm text-muted-foreground">
            Orders on call — book now, pay at pickup.{" "}
            {openCount > 0 ? (
              <>
                <span className="font-bold text-foreground">{openCount}</span> open ·{" "}
                {counts.PENDING} pending, {counts.READY} ready
              </>
            ) : (
              "The book is clear."
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
            Refresh
          </Button>
          <Button
            onClick={() => setFormOpen(true)}
            className="gap-2 rounded-xl font-bold"
          >
            <Plus className="h-4 w-4" /> New order
          </Button>
        </div>
      </div>

      {/* Filters + search */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order ID, customer name or phone…"
            className="sm:max-w-xs"
            aria-label="Search pre-orders"
          />
          <div className="rr-scroll flex gap-1.5 overflow-x-auto pb-0.5">
            {(["ALL", "PENDING", "READY", "DONE", "CANCELLED"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                  filter === s
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                )}
              >
                {s === "ALL" ? "All" : STATUS_META[s].label}
                <span className="ml-1.5 tabular-nums opacity-75">{counts[s]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Orders */}
      {orders === null ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading pre-orders…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <ClipboardList className="mx-auto h-8 w-8 text-muted-foreground/40" />
          <p className="mt-2 font-semibold">
            {search || filter !== "ALL" ? "No pre-orders match." : "No pre-orders yet."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || filter !== "ALL"
              ? "Try a different search or filter."
              : "Take a phone order with the “New order” button — it will show up here."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((o) => {
            const due = dueLabel(o.dueAt);
            const meta = STATUS_META[o.status];
            const live = o.status === "PENDING" || o.status === "READY";
            return (
              <article
                key={o.id}
                className={cn(
                  "rounded-xl border bg-card p-4 transition-shadow hover:shadow-md",
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
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", meta.cls)}>
                        {meta.label}
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
                          {due.overdue && live ? `Overdue · was ${due.text}` : `Pickup ${due.text}`}
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

                {o.note ? (
                  <p className="mt-2 rounded-lg border border-warning/30 bg-[#FCF7EF] px-2.5 py-1.5 text-xs font-semibold italic text-foreground">
                    “{o.note}”
                  </p>
                ) : null}

                <p className="mt-2 text-[11px] text-muted-foreground">
                  Taken by <span className="font-semibold">{o.createdBy}</span> ·{" "}
                  {formatDateTime(o.createdAt)}
                </p>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3">
                  {o.status === "PENDING" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o, "READY", `${o.orderId} marked as ready.`)}
                      className="h-8 gap-1.5 rounded-lg border-[#2E7D4F]/40 text-xs font-bold text-[#2E7D4F] hover:bg-[#2E7D4F] hover:text-white"
                    >
                      <Check className="h-3.5 w-3.5" /> Ready
                    </Button>
                  ) : null}
                  {o.status === "READY" ? (
                    <Button
                      size="sm"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o, "DONE", `${o.orderId} picked up — nice!`)}
                      className="h-8 gap-1.5 rounded-lg bg-[#2E7D4F] text-xs font-bold text-white hover:bg-[#256B43]"
                    >
                      <CheckCheck className="h-3.5 w-3.5" /> Picked up
                    </Button>
                  ) : null}
                  {live && role === "SALESMAN" ? (
                    <Button
                      size="sm"
                      onClick={() => loadIntoPos(o)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-bold"
                      title="Load these items into the counter cart"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" /> Load into POS
                    </Button>
                  ) : null}
                  {live ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === o.id}
                      onClick={() => void setStatus(o, "CANCELLED", `${o.orderId} cancelled.`)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-bold text-destructive hover:bg-destructive hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyId === o.id}
                      onClick={() => setDeleteTarget(o)}
                      className="h-8 gap-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
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
            <AlertDialogTitle>Remove order {deleteTarget?.orderId}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the closed order from the pre-order book. Sales records are
              not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && void removeOrder(deleteTarget)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
