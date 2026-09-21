"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, Sale, SessionUser } from "@/lib/types";

interface SessionState {
  user: SessionUser | null;
  setUser: (u: SessionUser) => void;
  clearUser: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (u) => set({ user: u }),
      clearUser: () => set({ user: null }),
    }),
    { name: "red-ribbons-pos-session" }
  )
);

/* ------------------------------------------------------------------ */
/* Parked (held) sales — a counter can pause one order and start the   */
/* next customer without losing the first cart. Persisted so a reload  */
/* doesn't lose parked orders.                                         */
/* ------------------------------------------------------------------ */

export interface HeldSale {
  id: string;
  at: string; // ISO timestamp
  items: CartItem[];
  paymentMethod: "CASH" | "ONLINE";
  cashInput: string;
  /** Raw discount input (Rs string) — re-clamped against the subtotal on resume */
  discount?: string;
  total: number;
}

interface HeldState {
  held: HeldSale[];
  hold: (data: Omit<HeldSale, "id" | "at">) => string;
  take: (id: string) => HeldSale | undefined;
  discard: (id: string) => void;
}

export const useHeldSales = create<HeldState>()(
  persist(
    (set, get) => ({
      held: [],
      hold: (data) => {
        const id = `H${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
        set((s) => ({ held: [{ ...data, id, at: new Date().toISOString() }, ...s.held].slice(0, 12) }));
        return id;
      },
      take: (id) => {
        const found = get().held.find((h) => h.id === id);
        if (found) set((s) => ({ held: s.held.filter((h) => h.id !== id) }));
        return found;
      },
      discard: (id) => set((s) => ({ held: s.held.filter((h) => h.id !== id) })),
    }),
    { name: "red-ribbons-pos-held" }
  )
);

/* ------------------------------------------------------------------ */
/* Last completed sale — lets the counter reprint the most recent      */
/* receipt without digging through the sales history. Persisted so it  */
/* survives a reload.                                                  */
/* ------------------------------------------------------------------ */

interface LastSaleState {
  sale: Sale | null;
  setSale: (s: Sale) => void;
}

export const useLastSale = create<LastSaleState>()(
  persist(
    (set) => ({
      sale: null,
      setSale: (sale) => set({ sale }),
    }),
    { name: "red-ribbons-pos-last-sale" }
  )
);

/* ------------------------------------------------------------------ */
/* Cart intent — lets another view (e.g. Pre-orders) hand a list of    */
/* items to the POS cart during an in-app navigation. Not persisted:   */
/* the hand-off is only meaningful while the app stays open.           */
/* ------------------------------------------------------------------ */

interface CartIntentState {
  /** Items waiting to be loaded into the POS cart (already stock-clamped). */
  pending: CartItem[] | null;
  /** Label for the toast, e.g. "RO-000012". */
  label: string | null;
  setIntent: (items: CartItem[], label: string) => void;
  consumeIntent: () => { items: CartItem[]; label: string } | null;
}

export const useCartIntent = create<CartIntentState>()((set, get) => ({
  pending: null,
  label: null,
  setIntent: (items, label) => set({ pending: items, label }),
  consumeIntent: () => {
    const { pending, label } = get();
    if (!pending || pending.length === 0) return null;
    set({ pending: null, label: null });
    return { items: pending, label: label ?? "" };
  },
}));
