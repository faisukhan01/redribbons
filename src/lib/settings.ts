"use client";

import { create } from "zustand";
import { api } from "./api";
import type { ShopSettings } from "./types";

/**
 * Owner-editable shop info (phone, address, receipt note) that prints on
 * receipts and the Z-report. Cached after the first load; every reader
 * (success screen, receipt dialog, print pipeline) shares one snapshot.
 */
interface SettingsState {
  settings: ShopSettings | null; // null = not loaded yet
  load: () => Promise<void>;
  save: (next: Partial<ShopSettings>) => Promise<ShopSettings>;
}

export const useShopSettings = create<SettingsState>()((set, get) => ({
  settings: null,
  load: async () => {
    if (get().settings) return; // already cached
    try {
      const data = await api<{ settings: ShopSettings }>("/api/settings");
      set({ settings: data.settings });
    } catch {
      // non-critical — receipts simply omit the extra lines
    }
  },
  save: async (next) => {
    const data = await api<{ settings: ShopSettings }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ settings: next }),
    });
    set({ settings: data.settings });
    return data.settings;
  },
}));
