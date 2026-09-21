"use client";

import { useState } from "react";
import { Crown, Delete, ShoppingBag } from "lucide-react";
import { BrandLockup } from "@/components/pos/brand";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Role, SessionUser } from "@/lib/types";

const ROLE_INFO: Record<Role, { title: string; desc: string; icon: typeof Crown }> = {
  OWNER: {
    title: "Owner",
    desc: "Business overview & stock",
    icon: Crown,
  },
  SALESMAN: {
    title: "Salesman",
    desc: "Counter checkout",
    icon: ShoppingBag,
  },
};

export function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  async function submitPin(finalPin: string) {
    if (!role) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api<{ user: SessionUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ role, pin: finalPin }),
      });
      onLogin(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in.");
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 450);
    } finally {
      setLoading(false);
    }
  }

  function pressKey(key: string) {
    setError(null);
    if (key === "del") {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (key === "clear") {
      setPin("");
      return;
    }
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      void submitPin(next);
    }
  }

  return (
    <div className="rr-ribbon-bg flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <BrandLockup size="lg" priority />

      <div
        className={cn(
          "mt-8 w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-[0_10px_40px_-18px_rgba(122,15,21,0.35)]",
          shake && "rr-shake"
        )}
      >
        {/* brand ribbon accent */}
        <div
          aria-hidden
          className="h-1.5 w-full"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #7A0F15 0%, #A91A24 30%, #C2373F 55%, #A91A24 80%, #7A0F15 100%)",
          }}
        />
        <div className="p-5 sm:p-6">
        {!role ? (
          <>
            <p className="mb-4 text-center text-sm font-semibold text-muted-foreground">
              Who is using the counter?
            </p>
            <div className="grid gap-3">
              {(Object.keys(ROLE_INFO) as Role[]).map((r) => {
                const info = ROLE_INFO[r];
                const Icon = info.icon;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-all hover:border-primary/60 hover:bg-accent/50 active:scale-[0.99]"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block font-display text-lg font-bold text-foreground">
                        {info.title}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {info.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-bold text-foreground">
                  {ROLE_INFO[role].title} login
                </p>
                <p className="text-xs text-muted-foreground">
                  Enter your 4-digit PIN
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRole(null);
                  setPin("");
                  setError(null);
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Change role
              </button>
            </div>

            {/* PIN dots */}
            <div className="mb-4 flex items-center justify-center gap-3" aria-label="PIN entry">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border-2 transition-all",
                    i < pin.length
                      ? "border-primary bg-primary scale-110"
                      : "border-input bg-transparent"
                  )}
                />
              ))}
            </div>

            {error ? (
              <p className="mb-3 text-center text-sm font-semibold text-destructive">
                {error}
              </p>
            ) : null}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "del"].map(
                (key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={loading}
                    onClick={() => pressKey(key)}
                    className={cn(
                      "flex h-14 items-center justify-center rounded-xl border text-xl font-semibold transition-colors active:scale-[0.97]",
                      key === "clear" || key === "del"
                        ? "border-transparent bg-transparent text-muted-foreground hover:text-primary"
                        : "bg-secondary/60 hover:bg-accent hover:border-primary/40",
                      loading && "opacity-50"
                    )}
                    aria-label={
                      key === "clear" ? "Clear PIN" : key === "del" ? "Delete digit" : key
                    }
                  >
                    {key === "del" ? (
                      <Delete className="h-5 w-5" />
                    ) : key === "clear" ? (
                      <span className="text-sm font-bold uppercase tracking-wide">Clear</span>
                    ) : (
                      key
                    )}
                  </button>
                )
              )}
            </div>
          </>
        )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Demo access — Owner PIN: 1234 · Salesman PIN: 1111
      </p>
    </div>
  );
}
