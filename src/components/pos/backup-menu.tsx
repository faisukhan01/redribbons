"use client";

import { useRef, useState } from "react";
import { DatabaseBackup, Download, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { downloadCSV, todayStamp } from "@/lib/csv";
import type { BackupFile } from "@/lib/types";

/** Owner-only header menu: download a full JSON backup or restore one. */
export function BackupMenu() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: BackupFile } | null>(null);
  const [restoring, setRestoring] = useState(false);

  async function downloadBackup() {
    try {
      toast.loading("Preparing backup…", { id: "backup" });
      const data = await api<BackupFile>("/api/backup");
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `red-ribbons-backup-${todayStamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(
        `Backup saved — ${data.products.length} products, ${data.sales.length} sales.`,
        { id: "backup" }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Backup failed.", { id: "backup" });
    }
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as BackupFile;
        if (data?.app !== "red-ribbons-pos" || !Array.isArray(data.products) || !Array.isArray(data.sales)) {
          toast.error("This file is not a valid Red Ribbons backup.");
          return;
        }
        setPending({ name: file.name, data });
      } catch {
        toast.error("Could not read the file — is it a valid .json backup?");
      }
    };
    reader.readAsText(file);
  }

  async function doRestore() {
    if (!pending) return;
    setRestoring(true);
    try {
      const res = await api<{ products: number; sales: number; items: number; skippedItems: number }>(
        "/api/backup",
        { method: "POST", body: JSON.stringify(pending.data) }
      );
      toast.success(
        `Restore complete — ${res.products} products, ${res.sales} sales restored.` +
          (res.skippedItems > 0 ? ` ${res.skippedItems} unknown item lines were skipped.` : "")
      );
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setRestoring(false);
      setPending(null);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-lg border-border/70 px-2.5 font-semibold text-muted-foreground hover:text-foreground"
            aria-label="Backup and restore data"
          >
            <DatabaseBackup className="h-4 w-4" />
            <span className="hidden lg:inline">Backup</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Data safety
          </DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void downloadBackup()} className="gap-2 py-2.5">
            <Download className="h-4 w-4 text-primary" />
            <div>
              <p className="text-sm font-semibold">Download backup</p>
              <p className="text-xs text-muted-foreground">Full snapshot (.json)</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => fileRef.current?.click()}
            className="gap-2 py-2.5 text-destructive data-[highlighted]:text-destructive"
          >
            <Upload className="h-4 w-4" />
            <div>
              <p className="text-sm font-semibold">Restore backup…</p>
              <p className="text-xs text-muted-foreground/80">Replaces all products &amp; sales</p>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={onPickFile}
        aria-label="Choose backup file"
      />

      <AlertDialog open={pending !== null} onOpenChange={(v) => !v && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-display">
              <RotateCcw className="h-5 w-5 text-destructive" />
              Restore this backup?
            </AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{pending?.name}</span> contains{" "}
              {pending?.data.products.length ?? 0} products and {pending?.data.sales.length ?? 0}{" "}
              sales. Restoring will <span className="font-bold text-destructive">permanently replace</span>{" "}
              all products and sales currently in the system. Staff accounts are kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doRestore();
              }}
              disabled={restoring}
              className="gap-2 bg-destructive text-white hover:bg-destructive/90"
            >
              {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <DatabaseBackup className="h-4 w-4" />}
              {restoring ? "Restoring…" : "Yes, restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
