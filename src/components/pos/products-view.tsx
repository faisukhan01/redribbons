"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Pencil, Plus, ScanBarcode, Search, Sheet, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductFilters, filterProducts } from "@/components/pos/inventory-view";
import { StockBadge } from "@/components/pos/shared";
import { ProductFormDialog } from "@/components/pos/product-form-dialog";
import { ImportDialog } from "@/components/pos/import-dialog";
import { api } from "@/lib/api";
import { formatNumber, formatPKR } from "@/lib/format";
import type { Product } from "@/lib/types";

export function ProductsView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [importMode, setImportMode] = useState<"excel" | "csv">("excel");
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Manual reload after create/edit/import/delete (never called during render)
  const load = useCallback(async () => {
    try {
      const data = await api<{ products: Product[] }>("/api/products");
      setProducts(data.products);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load products.");
    }
  }, []);

  // Initial load — setState happens in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api<{ products: Product[] }>("/api/products")
      .then((data) => {
        if (!cancelled) setProducts(data.products);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unable to load products.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set((products ?? []).map((p) => p.category))).sort(),
    [products]
  );
  const visible = useMemo(
    () => filterProducts(products ?? [], query, category),
    [products, query, category]
  );

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api(`/api/products/${deleting.id}`, { method: "DELETE" });
      toast.success("Product deleted");
      setDeleting(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete the product.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Products</h1>
          <p className="text-sm text-muted-foreground">
            Add products manually or import a list from Excel/CSV.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setImportMode("excel");
              setImportOpen(true);
            }}
          >
            <Sheet className="h-4 w-4" />
            Import Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setImportMode("csv");
              setImportOpen(true);
            }}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Import CSV
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      <ProductFilters
        query={query}
        onQuery={setQuery}
        category={category}
        onCategory={setCategory}
        categories={categories}
      />

      <div className="rounded-xl border bg-card">
        {products === null ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center">
            <ScanBarcode className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              {query || category !== "all"
                ? "No products match your search."
                : "No products yet — add your first product or import a list."}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="rr-scroll hidden max-h-[62vh] overflow-y-auto md:block">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_0_var(--border)]">
                  <TableRow>
                    <TableHead className="w-24">Product ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono font-semibold">{p.productId}</TableCell>
                      <TableCell className="font-semibold">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">{p.category}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPKR(p.price)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <StockBadge stock={p.stock} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatNumber(p.soldQuantity)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(p);
                              setFormOpen(true);
                            }}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
                            aria-label={`Edit ${p.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(p)}
                            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Delete ${p.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <div className="divide-y md:hidden">
              {visible.map((p) => (
                <div key={p.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono font-semibold text-foreground">{p.productId}</span>
                      {" · "}
                      {p.category}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <StockBadge stock={p.stock} />
                      <span className="text-xs text-muted-foreground">
                        {formatNumber(p.soldQuantity)} sold
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="font-bold tabular-nums text-primary">{formatPKR(p.price)}</p>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                        className="rounded-md border p-2 text-muted-foreground active:bg-accent"
                        aria-label={`Edit ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(p)}
                        className="rounded-md border p-2 text-muted-foreground active:bg-destructive/10 active:text-destructive"
                        aria-label={`Delete ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSaved={load}
      />
      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        mode={importMode}
        onImported={load}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(v) => !v && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  <span className="font-semibold text-foreground">{deleting.name}</span> (ID{" "}
                  {deleting.productId}) will be removed from the catalogue. This cannot be
                  undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={deleteBusy}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleteBusy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
