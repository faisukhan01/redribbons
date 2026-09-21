"use client";

import { useState } from "react";
import { Crown, KeyRound, LayoutDashboard, LogOut, Package, ReceiptText, ScanBarcode, ShoppingBag, Store } from "lucide-react";
import { BrandHeader } from "@/components/pos/brand";
import { AccountDialog } from "@/components/pos/account-dialog";
import { BackupMenu } from "@/components/pos/backup-menu";
import { ReceiptSettingsDialog } from "@/components/pos/receipt-settings-dialog";
import { cn } from "@/lib/utils";
import type { Role, SessionUser } from "@/lib/types";

export type View = "dashboard" | "inventory" | "sales" | "products" | "pos";

const NAV: Record<Role, Array<{ id: View; label: string; icon: typeof LayoutDashboard }>> = {
  OWNER: [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Inventory", icon: Package },
    { id: "sales", label: "Sales", icon: ReceiptText },
    { id: "products", label: "Products", icon: ScanBarcode },
  ],
  SALESMAN: [
    { id: "pos", label: "POS", icon: ShoppingBag },
    { id: "products", label: "Products", icon: ScanBarcode },
    { id: "sales", label: "Sales", icon: ReceiptText },
  ],
};

export function AppShell({
  user,
  view,
  onNavigate,
  onLogout,
  children,
}: {
  user: SessionUser;
  view: View;
  onNavigate: (v: View) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const items = NAV[user.role];
  const [accountOpen, setAccountOpen] = useState(false);
  const [receiptSettingsOpen, setReceiptSettingsOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4">
          <BrandHeader />

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {items.map((item) => {
              const Icon = item.icon;
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-accent text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="group flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1.5 text-right transition-colors hover:border-border hover:bg-muted sm:px-2.5"
              aria-label="Account settings — change PIN"
              title="Account — change PIN"
            >
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-tight text-foreground">{user.name}</p>
                <p className="flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {user.role === "OWNER" ? <Crown className="h-3 w-3 text-primary" /> : null}
                  {user.role === "OWNER" ? "Owner" : "Salesman"}
                </p>
              </div>
              <KeyRound className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
            </button>
            {user.role === "OWNER" ? (
              <button
                type="button"
                onClick={() => setReceiptSettingsOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Receipt details — phone, address, note"
                title="Receipt details (phone, address, note)"
              >
                <Store className="h-4 w-4" />
              </button>
            ) : null}
            {user.role === "OWNER" ? <BackupMenu /> : null}
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Account (change PIN) dialog */}
      <AccountDialog open={accountOpen} onOpenChange={setAccountOpen} user={user} />

      {/* Receipt details (owner) */}
      {user.role === "OWNER" ? (
        <ReceiptSettingsDialog open={receiptSettingsOpen} onOpenChange={setReceiptSettingsOpen} />
      ) : null}

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-28 pt-5 md:pb-10 md:pt-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="mb-16 mt-auto border-t bg-card md:mb-0">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-1 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row">
          <p className="text-xs text-muted-foreground">
            <span className="font-display font-bold text-primary">RED RIBBONS</span> · Bakery
            Point of Sale
          </p>
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} Red Ribbons Bakery
          </p>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card md:hidden"
        aria-label="Mobile navigation"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid auto-cols-fr grid-flow-col">
          {items.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[10px] font-semibold transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "scale-110")} />
                {item.label}
                <span
                  className={cn(
                    "h-0.5 w-6 rounded-full",
                    active ? "bg-primary" : "bg-transparent"
                  )}
                />
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
