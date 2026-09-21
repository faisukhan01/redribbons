"use client";

import { useState, useSyncExternalStore } from "react";
import { BrandLockup } from "@/components/pos/brand";
import { AppShell, type View } from "@/components/pos/app-shell";
import { LoginScreen } from "@/components/pos/login-screen";
import { OwnerDashboard } from "@/components/pos/owner-dashboard";
import { InventoryView } from "@/components/pos/inventory-view";
import { SalesHistory } from "@/components/pos/sales-history";
import { ProductsView } from "@/components/pos/products-view";
import { PosView } from "@/components/pos/pos-view";
import { OrdersView } from "@/components/pos/orders-view";
import { useSession } from "@/lib/store";
import type { SessionUser } from "@/lib/types";

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
          createdBy={user.name}
          onNavigate={(v) => setView(v)}
        />
      ) : null}
      {view === "pos" && user.role === "SALESMAN" ? <PosView salesmanName={user.name} /> : null}
    </AppShell>
  );
}
