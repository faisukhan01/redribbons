"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionUser } from "@/lib/types";

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
