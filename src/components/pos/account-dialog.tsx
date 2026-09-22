"use client";

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

/** Change-PIN dialog, opened from the header user block. */
export function AccountDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  user: SessionUser;
}) {
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setError(null);
    }
  }, [open]);

  async function submit() {
    setError(null);
    if (!/^\d{4,6}$/.test(currentPin)) return setError("Enter your current PIN (4–6 digits).");
    if (!/^\d{4,6}$/.test(newPin)) return setError("New PIN must be 4–6 digits.");
    if (newPin !== confirmPin) return setError("The two new PINs do not match.");
    setSaving(true);
    try {
      await api("/api/auth/change-pin", {
        method: "POST",
        body: JSON.stringify({ username: user.username, currentPin, newPin }),
      });
      toast.success("PIN updated — use the new PIN next time you sign in.");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the PIN.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <KeyRound className="h-5 w-5 text-primary" />
            Account — Change PIN
          </DialogTitle>
          <DialogDescription>
            Signed in as <span className="font-semibold text-foreground">{user.name}</span> (
            {user.role === "OWNER" ? "Owner" : "Salesman"}). Pick a PIN you can remember at the
            counter.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label htmlFor="cur-pin" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Current PIN
            </label>
            <Input
              id="cur-pin"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="off"
              className="mt-1.5 h-11 font-mono text-lg tracking-[0.4em]"
              placeholder="••••"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="new-pin" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                New PIN
              </label>
              <Input
                id="new-pin"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="new-password"
                className="mt-1.5 h-11 font-mono text-lg tracking-[0.4em]"
                placeholder="••••"
              />
            </div>
            <div>
              <label htmlFor="conf-pin" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Repeat PIN
              </label>
              <Input
                id="conf-pin"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="new-password"
                className="mt-1.5 h-11 font-mono text-lg tracking-[0.4em]"
                placeholder="••••"
              />
            </div>
          </div>

          {error ? (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
              {error}
            </p>
          ) : null}

          <Button onClick={() => void submit()} disabled={saving} className="h-11 w-full gap-2 rounded-xl font-bold">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {saving ? "Saving…" : "Update PIN"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
