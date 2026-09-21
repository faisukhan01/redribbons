"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Languages, Loader2, Plus, Printer, ReceiptText, Search, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CartPanel, type PayMethod } from "@/components/pos/cart-panel";
import { SaleSuccess } from "@/components/pos/sale-success";
import { ProductTile } from "@/components/pos/shared";
import { ReprintDialog } from "@/components/pos/reprint-dialog";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";
import { useHeldSales, useLastSale } from "@/lib/store";
import { useShopSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CartItem, Product, Sale } from "@/lib/types";

function dayStartMs() {
  const tzOffset = new Date().getTimezoneOffset();
  return Math.floor((Date.now() - tzOffset * 60_000) / 86_400_000) * 86_400_000 + tzOffset * 60_000;
}

export function PosView({ salesmanName }: { salesmanName: string }) {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [idInput, setIdInput] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>("CASH");
  const [cashInput, setCashInput] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [completing, setCompleting] = useState(false);
  const [success, setSuccess] = useState<Sale | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reprintOpen, setReprintOpen] = useState(false);
  const [myDay, setMyDay] = useState<{ count: number; revenue: number; items: number } | null>(null);
  const { t, isUr, toggle: toggleLang } = useT();
  const lastSale = useLastSale((s) => s.sale);

  const idInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const held = useHeldSales((s) => s.held);
  const holdSale = useHeldSales((s) => s.hold);
  const takeHeld = useHeldSales((s) => s.take);
  const discardHeld = useHeldSales((s) => s.discard);

  // Manual reload after a completed sale (stock changed) — never called during render
  const load = useCallback(async () => {
    try {
      const data = await api<{ products: Product[] }>("/api/products");
      setProducts(data.products);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load products.");
    }
  }, []);

  // The salesman's own numbers for today (shown as chips in the header)
  const loadMyDay = useCallback(async () => {
    try {
      const data = await api<{ sales: Sale[] }>(
        `/api/sales?limit=500&salesman=${encodeURIComponent(salesmanName)}&since=${new Date(dayStartMs()).toISOString()}`
      );
      setMyDay({
        count: data.sales.length,
        revenue: data.sales.reduce((s, x) => s + x.total, 0),
        items: data.sales.reduce((s, x) => s + x.items.reduce((n, i) => n + i.quantity, 0), 0),
      });
    } catch {
      // non-critical — silently ignore
    }
  }, [salesmanName]);

  // Initial load — setState happens in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api<{ products: Product[] }>("/api/products")
      .then((data) => {
        if (!cancelled) setProducts(data.products);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          toast.error(err instanceof Error ? err.message : "Unable to load products.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void loadMyDay();
    void useShopSettings.getState().load(); // for receipt shop lines
  }, [loadMyDay]);

  // Counter keyboard shortcuts: F2 → Product ID, F3 → payment, F4 → hold, / → search
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (e.key === "F2") {
        e.preventDefault();
        idInputRef.current?.focus();
      } else if (e.key === "F3") {
        e.preventDefault();
        setPaymentMethod((m) => (m === "CASH" ? "ONLINE" : "CASH"));
      } else if (e.key === "F4") {
        e.preventDefault();
        handleHoldRef.current();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const byCode = useMemo(() => {
    const map = new Map<string, Product>();
    (products ?? []).forEach((p) => map.set(p.productId.toLowerCase(), p));
    return map;
  }, [products]);

  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.category))).sort(),
    [products]
  );

  // Quick-add with quantity: "101*3" or "101x3" adds 3× product 101 at once.
  const QUICK_ADD_RE = /^(\S+?)\s*[*xX]\s*(\d{1,3})$/;
  const parsedInput = useMemo(() => {
    const raw = idInput.trim();
    if (!raw) return { product: null as Product | null, qty: 1 };
    const m = raw.match(QUICK_ADD_RE);
    if (m) {
      const qty = Math.max(1, Math.min(999, parseInt(m[2], 10) || 1));
      return { product: byCode.get(m[1].toLowerCase()) ?? null, qty };
    }
    return { product: byCode.get(raw.toLowerCase()) ?? null, qty: 1 };
  }, [idInput, byCode]);
  const preview = parsedInput.product;

  const browse = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (category !== "all" && p.category !== category) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q);
    });
  }, [products, search, category]);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  // Discount is clamped to the subtotal; payable total = subtotal − discount
  const discount = Math.max(0, Math.min(parseFloat(discountInput || "0") || 0, total));
  const payable = Math.max(0, Math.round((total - discount) * 100) / 100);
  const received = paymentMethod === "CASH" ? parseFloat(cashInput || "0") || 0 : payable;
  const change = Math.max(0, received - payable);

  function addToCart(p: Product, qty = 1) {
    if (p.stock <= 0) {
      toast.error(`${p.name} is out of stock.`);
      return;
    }
    setCart((prev) => {
      const line = prev.find((i) => i.productId === p.id);
      if (line) {
        if (line.quantity + qty > p.stock) {
          toast.error(`Insufficient stock. Only ${p.stock} items are available.`);
          return prev;
        }
        return prev.map((i) =>
          i.productId === p.id ? { ...i, quantity: i.quantity + qty, stock: p.stock } : i
        );
      }
      if (qty > p.stock) {
        toast.error(`Insufficient stock. Only ${p.stock} items are available.`);
        return prev;
      }
      return [
        ...prev,
        { productId: p.id, code: p.productId, name: p.name, price: p.price, stock: p.stock, quantity: qty },
      ];
    });
  }

  function handleIdAdd() {
    const raw = idInput.trim();
    if (!raw) {
      toast.error("Please enter a Product ID.");
      return;
    }
    if (!parsedInput.product) {
      toast.error("Product not found. Check the ID and try again.");
      return;
    }
    addToCart(parsedInput.product, parsedInput.qty);
    setIdInput("");
  }

  function setQty(productId: number, qty: number) {
    setCart((prev) => {
      if (qty <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) => {
        if (i.productId !== productId) return i;
        if (qty > i.stock) {
          toast.error(`Insufficient stock. Only ${i.stock} items are available.`);
          return { ...i, quantity: i.stock };
        }
        return { ...i, quantity: qty };
      });
    });
  }

  function removeLine(productId: number) {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  }

  function clearCart() {
    setCart([]);
    setCashInput("");
    setDiscountInput("");
  }

  /** Park the current cart (with its payment state) and clear the counter. */
  function handleHold() {
    if (cart.length === 0) return;
    holdSale({ items: cart, paymentMethod, cashInput, discount: discountInput, total: payable });
    clearCart();
    toast.success("Order parked — you can start the next customer now.", {
      description: "Resume it any time from the parked list on the cart.",
    });
  }

  // Latest handleHold for the global F4 listener (avoids stale closure)
  const handleHoldRef = useRef(handleHold);
  handleHoldRef.current = handleHold;

  /** Resume a parked order. If the counter has an active cart, swap the two. */
  function handleResume(id: string) {
    const h = takeHeld(id);
    if (!h) return;
    // Re-clamp quantities against the latest stock before loading the cart
    const clamped: CartItem[] = [];
    for (const item of h.items) {
      const live = products?.find((p) => p.id === item.productId);
      const maxStock = live ? live.stock : item.stock;
      const qty = Math.min(item.quantity, maxStock);
      if (qty > 0) clamped.push({ ...item, stock: maxStock, quantity: qty });
    }
    if (clamped.length === 0) {
      toast.error("Parked order can no longer be resumed — its items are out of stock.");
      return;
    }
    const dropped = h.items.reduce((s, i) => s + i.quantity, 0) - clamped.reduce((s, i) => s + i.quantity, 0);
    if (cart.length > 0) {
      holdSale({ items: cart, paymentMethod, cashInput, discount: discountInput, total: payable });
      toast.info("Current order parked — resumed the other one.");
    }
    setCart(clamped);
    setPaymentMethod(h.paymentMethod);
    setCashInput(h.cashInput);
    setDiscountInput(h.discount ?? "");
    toast.success(
      dropped > 0
        ? `Order resumed — ${dropped} ${dropped === 1 ? "unit" : "units"} removed (out of stock).`
        : "Order resumed."
    );
  }

  function handleDiscard(id: string) {
    discardHeld(id);
    toast.success("Parked order discarded.");
  }

  async function completeSale() {
    if (cart.length === 0) return;
    setCompleting(true);
    try {
      const res = await api<{ sale: Sale }>("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod,
          amountReceived: paymentMethod === "CASH" ? received : null,
          discount: discount > 0 ? discount : null,
          salesman: salesmanName,
        }),
      });
      setSuccess(res.sale);
      useLastSale.getState().setSale(res.sale); // enables "reprint last receipt"
      clearCart();
      setIdInput("");
      setSheetOpen(false);
      toast.success("Sale completed successfully");
      void load(); // refresh stock
      void loadMyDay(); // refresh the header chips
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sale could not be completed.");
    } finally {
      setCompleting(false);
    }
  }

  if (success) {
    return <SaleSuccess sale={success} onNewSale={() => setSuccess(null)} />;
  }

  return (
    <div className={cn("space-y-4", isUr && "rr-urdu")}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold sm:text-3xl">{t("posTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("posFlow")}
            <span className="ml-2 hidden rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary md:inline">
              {t("tipQuickAdd")}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          {/* Counter tools: language + reprint last receipt */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleLang}
              title="Counter language / کاؤنٹر کی زبان"
              className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-bold shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
            >
              <Languages className="h-3.5 w-3.5 text-primary" />
              {isUr ? "English" : "اردو"}
            </button>
            {lastSale ? (
              <button
                type="button"
                onClick={() => setReprintOpen(true)}
                title="Reprint the most recent receipt"
                className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-bold shadow-sm transition-colors hover:border-primary/40 hover:text-primary"
              >
                <Printer className="h-3.5 w-3.5 text-primary" />
                {t("reprintLast")}
              </button>
            ) : null}
          </div>
          {/* Shortcut hints (desktop) */}
          <div className="hidden items-center gap-1.5 text-[11px] font-semibold text-muted-foreground lg:flex" aria-hidden>
            <Kbd>F2</Kbd> ID
            <Kbd>F3</Kbd> {t("cash")}/{t("online")}
            <Kbd>F4</Kbd> {t("hold")}
            <Kbd>/</Kbd> {t("searchPlaceholder").split(" ")[0]}
          </div>
          {/* Salesman's own day so far */}
          {myDay ? (
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm">
                <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                {t("today")}: <span className="tabular-nums font-bold">{myDay.count}</span>
                {myDay.count === 1 ? t("sale") : t("sales")}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm">
                <ReceiptText className="h-3.5 w-3.5 text-primary" />
                <span className="tabular-nums font-bold text-primary">{formatPKR(myDay.revenue)}</span>
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-semibold shadow-sm sm:flex">
                <span className="tabular-nums font-bold">{myDay.items}</span>
                {myDay.items === 1 ? t("item") : t("items")} {t("itemsSold")}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_minmax(370px,410px)]">
        {/* Left: lookup + browse */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <label
              htmlFor="pos-id"
              className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
            >
              {t("productId")}
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Input
                  id="pos-id"
                  ref={idInputRef}
                  value={idInput}
                  onChange={(e) => setIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleIdAdd();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setIdInput("");
                    }
                  }}
                  placeholder="e.g. 101 · or 101*3 for qty"
                  inputMode="text"
                  autoFocus
                  autoComplete="off"
                  className="h-14 rounded-xl pr-20 font-mono text-xl font-bold tracking-wide"
                />
                {idInput === "" ? (
                  <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1 sm:flex">
                    <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted-foreground shadow-sm">
                      Enter
                    </kbd>
                    <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground/60" />
                  </span>
                ) : null}
              </div>
              <Button
                onClick={handleIdAdd}
                className="h-14 gap-2 rounded-xl px-6 text-base font-bold uppercase tracking-wide sm:px-8"
              >
                <Plus className="h-5 w-5" /> {t("add")}
              </Button>
            </div>

            {/* Live preview */}
            {idInput.trim() !== "" ? (
              preview ? (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-primary/25 border-l-4 border-l-primary bg-accent/50 p-3.5">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold">{preview.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {parsedInput.qty > 1 ? (
                        <>
                          <span className="font-bold text-primary">{parsedInput.qty} × {formatPKR(preview.price)}</span>
                          {" = "}
                          <span className="font-bold text-primary">{formatPKR(preview.price * parsedInput.qty)}</span>
                          {" · "}
                        </>
                      ) : (
                        <span className="font-bold text-primary">{formatPKR(preview.price)}</span>
                      )}
                      {" · "}
                      {t("available")}: 
                      <span className="font-bold text-foreground">{preview.stock}</span>
                      {" · "}
                      {preview.category}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-xs font-semibold text-muted-foreground sm:block">
                    {t("pressEnterOrAdd")}
                  </span>
                </div>
              ) : (
                <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm font-semibold text-muted-foreground">
                  {isUr
                    ? `“${idInput.trim()}” — ${t("noProductFound")}`
                    : `No product found with ID “${idInput.trim()}” — check and try again.`}
                </p>
              )
            ) : null}
          </div>

          {/* Browse */}
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isUr ? "یا پروڈکٹ کے نام سے تلاش کریں… ( / )" : "Or search by product name…  ( / )"}
                className="pl-9"
                aria-label="Search products"
              />
            </div>

            <div className="rr-scroll mt-3 flex gap-1.5 overflow-x-auto pb-1">
              {["all", ...categories].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={cn(
                    "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors",
                    category === c
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  )}
                >
                  {c === "all" ? t("all") : c}
                </button>
              ))}
            </div>

            {products === null ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("loadingProducts")}
              </div>
            ) : browse.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {t("noProductsMatch")}
              </p>
            ) : (
              <div className="rr-scroll mt-3 grid max-h-[38vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:max-h-[42vh] xl:grid-cols-4">
                {browse.map((p) => (
                  <ProductTile
                    key={p.id}
                    name={p.name}
                    price={p.price}
                    stock={p.stock}
                    onClick={() => addToCart(p)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: cart + payment (desktop) */}
        <div className="hidden rounded-xl border bg-card p-4 sm:p-5 lg:sticky lg:top-20 lg:block">
          <CartPanel
            cart={cart}
            subtotal={total}
            discount={discount}
            onDiscount={setDiscountInput}
            total={payable}
            paymentMethod={paymentMethod}
            onPaymentMethod={setPaymentMethod}
            cashInput={cashInput}
            onCashInput={setCashInput}
            received={received}
            change={change}
            completing={completing}
            held={held}
            onHold={handleHold}
            onResume={handleResume}
            onDiscard={handleDiscard}
            onSetQty={setQty}
            onRemove={removeLine}
            onClear={clearCart}
            onComplete={() => void completeSale()}
          />
        </div>
      </div>

      {/* Mobile sticky checkout bar */}
      {cart.length > 0 ? (
        <div
          className="fixed inset-x-0 bottom-16 z-30 border-t bg-card/95 px-4 py-3 backdrop-blur lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-muted-foreground">
                {cart.reduce((s, i) => s + i.quantity, 0)}{" "}
                {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? t("item") : t("items")} {t("inCart")}
              </p>
              <p className="truncate font-display text-xl font-bold tabular-nums text-primary">
                {formatPKR(payable)}
              </p>
            </div>
            <Button
              onClick={() => setSheetOpen(true)}
              className="h-12 gap-2 rounded-xl px-6 font-bold uppercase tracking-wide"
            >
              <ShoppingBag className="h-4 w-4" /> {t("checkout")}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Mobile checkout sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rr-scroll max-h-[92dvh] overflow-y-auto rounded-t-2xl p-5">
          <SheetHeader className="p-0 pb-2">
            <SheetTitle className="font-display text-xl">{t("checkout")}</SheetTitle>
            <SheetDescription className="sr-only">
              Review the cart, choose a payment method and complete the sale.
            </SheetDescription>
          </SheetHeader>
          <CartPanel
            cart={cart}
            subtotal={total}
            discount={discount}
            onDiscount={setDiscountInput}
            total={payable}
            paymentMethod={paymentMethod}
            onPaymentMethod={setPaymentMethod}
            cashInput={cashInput}
            onCashInput={setCashInput}
            received={received}
            change={change}
            completing={completing}
            held={held}
            onHold={handleHold}
            onResume={handleResume}
            onDiscard={handleDiscard}
            onSetQty={setQty}
            onRemove={removeLine}
            onClear={clearCart}
            onComplete={() => void completeSale()}
          />
        </SheetContent>
      </Sheet>

      {/* Reprint the most recent receipt */}
      <ReprintDialog open={reprintOpen} onOpenChange={setReprintOpen} sale={lastSale} />
    </div>
  );
}

/** Tiny keyboard-key chip used in the shortcut hints. */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-bold text-muted-foreground shadow-sm">
      {children}
    </kbd>
  );
}
