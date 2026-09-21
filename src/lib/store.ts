"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, SessionUser } from "@/lib/types";

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
