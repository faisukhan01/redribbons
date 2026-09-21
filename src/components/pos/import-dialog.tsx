"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ImportResult } from "@/lib/types";

interface ParsedRow {
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

interface RowError {
  row: number;
  reason: string;
}

const HEADER_KEYS: Record<keyof ParsedRow, string[]> = {
  productId: ["productid", "id", "code", "sku", "productcode"],
  name: ["name", "product", "productname", "item"],
  category: ["category", "cat", "type"],
  price: ["price", "rate", "unitprice", "retailprice"],
  quantity: ["quantity", "qty", "stock", "availablequantity", "available", "availableqty"],
};

function matchKey(header: string): keyof ParsedRow | null {
  const clean = String(header).toLowerCase().replace(/[^a-z]/g, "");
  for (const [field, keys] of Object.entries(HEADER_KEYS) as Array<
    [keyof ParsedRow, string[]]
  >) {
    if (keys.includes(clean)) return field;
  }
  return null;
}

function parseWorkbook(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const wb = XLSX.read(new Uint8Array(reader.result as ArrayBuffer), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) throw new Error("The file has no sheets.");
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        resolve(json);
      } catch (err) {
        reject(new Error("Could not read this file. Please use a valid Excel or CSV file."));
      }
    };
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsArrayBuffer(file);
  });
}

function normalizeRows(raw: Record<string, unknown>[]): {
  rows: ParsedRow[];
  errors: RowError[];
} {
  const rows: ParsedRow[] = [];
  const errors: RowError[] = [];
  const seen = new Set<string>();
  const codeRe = /^[A-Za-z0-9_-]+$/;

  raw.forEach((r, i) => {
    const rowNo = i + 2; // +1 header, +1 human counting
    const mapped: Partial<ParsedRow> = {};
    for (const key of Object.keys(r)) {
      const field = matchKey(key);
      if (field && mapped[field] === undefined) {
        mapped[field] = (r[key] ?? "") as ParsedRow[typeof field];
      }
    }
    const productId = String(mapped.productId ?? "").trim();
    const name = String(mapped.name ?? "").trim();
    const category = String(mapped.category ?? "").trim() || "Bakery";
    const price = Number(String(mapped.price ?? "").toString().replace(/[^\d.]/g, ""));
    const quantity = Math.round(Number(String(mapped.quantity ?? "").toString().replace(/[^\d-]/g, "")));

    if (!productId) return errors.push({ row: rowNo, reason: "Missing Product ID" });
    if (!codeRe.test(productId))
      return errors.push({ row: rowNo, reason: `Invalid Product ID "${productId}"` });
    if (!name) return errors.push({ row: rowNo, reason: `Missing product name for ID ${productId}` });
    if (!Number.isFinite(price) || price <= 0)
      return errors.push({ row: rowNo, reason: `Invalid price for ${name || productId}` });
    if (!Number.isInteger(quantity) || quantity < 0)
      return errors.push({ row: rowNo, reason: `Invalid quantity for ${name || productId}` });
    const dedupeKey = productId.toUpperCase();
    if (seen.has(dedupeKey))
      return errors.push({ row: rowNo, reason: `Duplicate Product ID "${productId}" in file` });
    seen.add(dedupeKey);
    rows.push({ productId, name, category, price, quantity });
  });

  return { rows, errors };
}

function downloadTemplate() {
  const csv = [
    "Product ID,Product Name,Category,Price,Quantity",
    "501,Chocolate Donut,Bakery,90,40",
    "502,Blueberry Muffin,Bakery,130,25",
    "503,Pistachio Barfi,Sweets,750,12",
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "red-ribbons-product-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportDialog({
  open,
  onOpenChange,
  mode,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "excel" | "csv";
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [errors, setErrors] = useState<RowError[] | null>(null);
  const [importing, setImporting] = useState(false);

  const accept = mode === "csv" ? ".csv,text/csv" : ".xlsx,.xls,.csv";

  function reset() {
    setFileName(null);
    setRows(null);
    setErrors(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(file: File) {
    setFileName(file.name);
    try {
      const raw = await parseWorkbook(file);
      if (raw.length === 0) {
        setRows([]);
        setErrors([{ row: 1, reason: "The file has no data rows." }]);
        return;
      }
      const { rows: parsed, errors: errs } = normalizeRows(raw);
      setRows(parsed);
      setErrors(errs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read the file.");
      reset();
    }
  }

  async function confirmImport() {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    try {
      const result = await api<ImportResult>("/api/products/import", {
        method: "POST",
        body: JSON.stringify({ rows }),
      });
      if (result.imported > 0) {
        toast.success(
          `Import complete — ${result.imported} ${result.imported === 1 ? "product" : "products"} added` +
            (result.skipped.length > 0 ? `, ${result.skipped.length} skipped.` : ".")
        );
      } else {
        toast.error("Nothing was imported — every row had a problem.");
      }
      onImported();
      onOpenChange(false);
      reset();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const preview = useMemo(() => rows?.slice(0, 6) ?? [], [rows]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            Import Products ({mode === "csv" ? "CSV" : "Excel"})
          </DialogTitle>
          <DialogDescription>
            Upload a file with columns: Product ID, Product Name, Category, Price, Quantity.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />

        {!rows ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-input bg-muted/40 p-8 transition-colors",
              "hover:border-primary/50 hover:bg-accent/40"
            )}
          >
            <Upload className="h-8 w-8 text-primary" />
            <span className="text-sm font-semibold">
              Tap to choose a {mode === "csv" ? "CSV" : "Excel"} file
            </span>
            <span className="text-xs text-muted-foreground">
              {mode === "csv" ? ".csv" : ".xlsx, .xls"} — up to 2,000 products
            </span>
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate font-semibold">{fileName}</span>
              </span>
              <button
                type="button"
                onClick={reset}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Choose different file
              </button>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1.5 font-semibold text-[#2E7D4F]">
                <CheckCircle2 className="h-4 w-4" />
                {rows.length} ready to import
              </span>
              {errors && errors.length > 0 ? (
                <span className="flex items-center gap-1.5 font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  {errors.length} {errors.length === 1 ? "row" : "rows"} will be skipped
                </span>
              ) : null}
            </div>

            {rows.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/70 text-left">
                    <tr>
                      <th className="px-2.5 py-2 font-semibold">ID</th>
                      <th className="px-2.5 py-2 font-semibold">Name</th>
                      <th className="px-2.5 py-2 font-semibold">Category</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Price</th>
                      <th className="px-2.5 py-2 text-right font-semibold">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.map((r) => (
                      <tr key={r.productId}>
                        <td className="px-2.5 py-1.5 font-mono font-semibold">{r.productId}</td>
                        <td className="px-2.5 py-1.5">{r.name}</td>
                        <td className="px-2.5 py-1.5 text-muted-foreground">{r.category}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{formatPKR(r.price)}</td>
                        <td className="px-2.5 py-1.5 text-right tabular-nums">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > preview.length ? (
                  <p className="bg-muted/40 px-2.5 py-1.5 text-center text-[11px] text-muted-foreground">
                    + {rows.length - preview.length} more rows
                  </p>
                ) : null}
              </div>
            ) : null}

            {errors && errors.length > 0 ? (
              <div className="rr-scroll max-h-32 space-y-1 overflow-y-auto rounded-lg border border-warning/30 bg-[#FCF7EF] p-3">
                {errors.slice(0, 8).map((e, i) => (
                  <p key={i} className="text-xs text-warning">
                    <span className="font-bold">Row {e.row}:</span> {e.reason}
                  </p>
                ))}
                {errors.length > 8 ? (
                  <p className="text-xs text-muted-foreground">+ {errors.length - 8} more issues</p>
                ) : null}
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Download sample template
          </button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void confirmImport()}
              disabled={!rows || rows.length === 0 || importing}
            >
              {importing
                ? "Importing…"
                : `Import ${rows?.length ?? 0} ${rows?.length === 1 ? "product" : "products"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
