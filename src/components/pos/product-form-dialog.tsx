"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

const CATEGORY_SUGGESTIONS = ["Bakery", "Cakes", "Sweets", "Snacks"];

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null; // null = create
  onSaved: () => void;
}) {
  const isEdit = product !== null;
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Bakery");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [addStock, setAddStock] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setProductId(product?.productId ?? "");
      setName(product?.name ?? "");
      setCategory(product?.category ?? "Bakery");
      setPrice(product ? String(product.price) : "");
      setQuantity("");
      setAddStock("");
    }
  }, [open, product]);

  async function handleSave() {
    setSaving(true);
    try {
      if (isEdit && product) {
        await api(`/api/products/${product.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name,
            category,
            price: Number(price),
            ...(addStock ? { addStock: Number(addStock) } : {}),
          }),
        });
        toast.success("Product updated successfully");
      } else {
        await api("/api/products", {
          method: "POST",
          body: JSON.stringify({
            productId,
            name,
            category,
            price: Number(price),
            stock: quantity === "" ? 0 : Number(quantity),
          }),
        });
        toast.success("Product added successfully");
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the product.");
    } finally {
      setSaving(false);
    }
  }

  const priceValid = Number(price) > 0;
  const stockValid = isEdit
    ? addStock === "" || (Number.isInteger(Number(addStock)) && Number(addStock) > 0)
    : quantity === "" || (Number.isInteger(Number(quantity)) && Number(quantity) >= 0);
  const valid =
    (!isEdit || true) &&
    (isEdit || productId.trim() !== "") &&
    name.trim() !== "" &&
    category.trim() !== "" &&
    priceValid &&
    stockValid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isEdit ? "Edit Product" : "Add Product"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details or add fresh stock to this product."
              : "Create a new product for the bakery counter."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-id">Product ID</Label>
              <Input
                id="pf-id"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                placeholder="101"
                disabled={isEdit}
                className="font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pf-cat">Category</Label>
              <Input
                id="pf-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                list="pf-categories"
                placeholder="Bakery"
              />
              <datalist id="pf-categories">
                {CATEGORY_SUGGESTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="pf-name">Product Name</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fresh Bread"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pf-price">Price (Rs.)</Label>
              <Input
                id="pf-price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="120"
              />
            </div>
            {isEdit ? (
              <div className="grid gap-1.5">
                <Label htmlFor="pf-stock">
                  Add Stock {product ? <span className="text-muted-foreground">(now {product.stock})</span> : null}
                </Label>
                <Input
                  id="pf-stock"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={addStock}
                  onChange={(e) => setAddStock(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
            ) : (
              <div className="grid gap-1.5">
                <Label htmlFor="pf-qty">Available Quantity</Label>
                <Input
                  id="pf-qty"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="50"
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!valid || saving}>
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Save Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
