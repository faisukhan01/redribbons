"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { BrandLockup } from "@/components/pos/brand";
import { AppShell, type View } from "@/components/pos/app-shell";
import { LoginScreen } from "@/components/pos/login-screen";
import { OwnerDashboard } from "@/components/pos/owner-dashboard";
import { InventoryView } from "@/components/pos/inventory-view";
import { SalesHistory } from "@/components/pos/sales-history";
import { ProductsView } from "@/components/pos/products-view";
import { PosView } from "@/components/pos/pos-view";
import { OrdersView } from "@/components/pos/orders-view";
import { api } from "@/lib/api";
import { useSession } from "@/lib/store";
import { displayName, type SessionUser } from "@/lib/types";

const emptySubscribe = () => () => {};

export function PosApp() {
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const clearUser = useSession((s) => s.clearUser);
  const [view, setView] = useState<View>(() =>
    // zustand persist rehydrates synchronously from localStorage on the client,
    // so the saved role is already available in the initial state.
    useSession.getState().user?.role === "SALESMAN" ? "pos" : "dashboard"
  );

  // false during SSR + hydration pass, true on the first client render after —
  // lets the persisted session rehydrate without a hydration mismatch.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Self-heal persisted sessions: a device may still hold an old cached user
  // (e.g. the salesman account was renamed). Silently refresh it from the
  // server on load — no logout needed. Fails silently when offline.
  useEffect(() => {
    const cached = useSession.getState().user;
    if (!cached) return;
    let cancelled = false;
    api<{ user: SessionUser }>(`/api/auth/session?role=${cached.role}`)
      .then((data) => {
        if (cancelled || !data.user) return;
        const u = data.user;
        const cur = useSession.getState().user;
        if (cur && (u.username !== cur.username || u.name !== cur.name || u.role !== cur.role)) {
          useSession.getState().setUser(u);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mounted) {
    return (
      <div className="rr-ribbon-bg flex min-h-screen items-center justify-center">
        <BrandLockup size="lg" className="animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={(u: SessionUser) => {
          setUser(u);
          setView(u.role === "OWNER" ? "dashboard" : "pos");
        }}
      />
    );
  }

  const handleLogout = () => {
    clearUser();
    setView("dashboard");
  };

  const handleNavigate = (v: View) => setView(v);

  return (
    <AppShell user={user} view={view} onNavigate={handleNavigate} onLogout={handleLogout}>
      {user.role === "OWNER" && view === "dashboard" ? (
        <OwnerDashboard onNavigate={handleNavigate} />
      ) : null}
      {view === "inventory" && user.role === "OWNER" ? <InventoryView /> : null}
      {view === "sales" ? <SalesHistory /> : null}
      {view === "products" ? <ProductsView /> : null}
      {view === "orders" ? (
        <OrdersView
          role={user.role}
          createdBy={displayName(user)}
          onNavigate={(v) => setView(v)}
        />
      ) : null}
      {view === "pos" && user.role === "SALESMAN" ? (
        <PosView salesmanName={displayName(user)} />
      ) : null}
    </AppShell>
  );
}
