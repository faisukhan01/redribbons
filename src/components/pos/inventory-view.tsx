"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, Download, Package, ReceiptText, Search, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, StockBadge } from "@/components/pos/shared";
import { api } from "@/lib/api";
import { downloadCSV, todayStamp } from "@/lib/csv";
import { formatNumber, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductFilters({
  query,
  onQuery,
  category,
  onCategory,
  categories,
  placeholder = "Search product name or ID…",
}: {
  query: string;
  onQuery: (v: string) => void;
  category: string;
  onCategory: (v: string) => void;
  categories: string[];
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
          aria-label="Search products"
        />
      </div>
      <Select value={category} onValueChange={onCategory}>
        <SelectTrigger className="w-full sm:w-44" aria-label="Filter by category">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function filterProducts(
  products: Product[],
  query: string,
  category: string
): Product[] {
  const q = query.trim().toLowerCase();
  return products.filter((p) => {
    if (category !== "all" && p.category !== category) return false;
    if (!q) return true;
    return (
      p.name.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q)
    );
  });
}

export function InventoryView() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  // Initial load — setState happens in promise callbacks
  useEffect(() => {
    let cancelled = false;
    api<{ products: Product[] }>("/api/products")
      .then((data) => {
        if (!cancelled) setProducts(data.products);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Unable to load inventory.");
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

  const totalStock = (products ?? []).reduce((s, p) => s + p.stock, 0);
  const totalSold = (products ?? []).reduce((s, p) => s + p.soldQuantity, 0);
  const stockValue = (products ?? []).reduce((s, p) => s + p.price * p.stock, 0);

  function exportCSV() {
    if (!products || products.length === 0) {
      toast.error("Nothing to export — inventory is empty.");
      return;
    }
    downloadCSV(
      `red-ribbons-inventory-${todayStamp()}.csv`,
      ["Product ID", "Name", "Category", "Price (Rs.)", "Stock", "Sold", "Stock Value (Rs.)"],
      products.map((p) => [p.productId, p.name, p.category, p.price, p.stock, p.soldQuantity, p.price * p.stock])
    );
    toast.success(`Exported ${products.length} products to CSV.`);
  }

  const lowCount = (products ?? []).filter((p) => p.stock <= 5).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            What came in, what sold, and what remains.
            {lowCount > 0 ? (
              <span className="font-semibold text-warning"> {lowCount} need restocking.</span>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV} disabled={products === null || products.length === 0} className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Products" value={formatNumber(products?.length ?? 0)} icon={Package} />
        <StatCard label="Items in Stock" value={formatNumber(totalStock)} icon={Boxes} />
        <StatCard label="Units Sold (all time)" value={formatNumber(totalSold)} icon={ReceiptText} />
        <StatCard label="Stock Value" value={formatPKR(stockValue)} icon={Wallet} />
      </div>

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
            <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No products match your search.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((p) => (
                    <TableRow
                      key={p.id}
                      className={cn(
                        p.stock <= 0 ? "bg-[#FBE9E7]/60" : p.stock <= 5 ? "bg-[#FCF7EF]/70" : ""
                      )}
                    >
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
                    <div className="mt-1.5">
                      <StockBadge stock={p.stock} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums text-primary">{formatPKR(p.price)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(p.soldQuantity)} sold
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
