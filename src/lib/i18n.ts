"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Counter language toggle (English / Urdu).
 * Scoped to the counter-facing POS screen — the owner back-office stays in
 * English. Persisted so the counter keeps its language across reloads.
 */
export type Lang = "en" | "ur";

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

export const useLang = create<LangState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (l) => set({ lang: l }),
      toggle: () => set({ lang: get().lang === "en" ? "ur" : "en" }),
    }),
    { name: "red-ribbons-pos-lang" }
  )
);

/** English → Urdu strings for the counter (POS screen + cart). */
const UR: Record<string, string> = {
  // header / flow
  posTitle: "پی او ایس — نئی سیل",
  posFlow: "پروڈکٹ آئی ڈی → شامل کریں → ادائیگی → سیل مکمل کریں",
  tipQuickAdd: "ٹپ: “101*3” ایک ساتھ 3 شامل کرتا ہے",
  today: "آج",
  sale: "سیل",
  sales: "سیلیں",
  item: "آئٹم",
  items: "آئٹمز",
  itemsSold: "فروخت ہوئے",
  // lookup
  productId: "پروڈکٹ آئی ڈی",
  add: "شامل کریں",
  searchPlaceholder: "یا پروڈکٹ کے نام سے تلاش کریں…",
  all: "سب",
  available: "دستیاب",
  pressEnterOrAdd: "انٹر دبائیں یا ADD",
  noProductFound: "اس آئی ڈی کا کوئی پروڈکٹ نہیں ملا — دوبارہ کوشش کریں۔",
  loadingProducts: "پروڈکٹس لوڈ ہو رہے ہیں…",
  noProductsMatch: "تلاش سے کوئی پروڈکٹ نہیں ملا۔",
  // cart
  currentSale: "موجودہ سیل",
  cartEmpty: "کارٹ خالی ہے",
  cartEmptyHint: "شروع کرنے کے لیے پروڈکٹ آئی ڈی لکھیں یا پروڈکٹ پر ٹیپ کریں",
  hold: "روکیں",
  clear: "صاف کریں",
  parkedOrders: "روکی ہوئی سلیں",
  resume: "دوبارہ شروع کریں",
  subtotal: "ذیلی رقم",
  total: "کل",
  discount: "رعایت",
  discountApplied: "رعایت لاگو ہے —",
  off: "کم",
  max: "زیادہ سے زیادہ",
  maxStock: "پوری اسٹاک",
  each: "فی یونٹ",
  // payment
  cash: "نقد",
  online: "آن لائن",
  customerGives: "گاہک نے دیے",
  exact: "پوری رقم",
  change: "واجب الادا رقم",
  enterAmountToCalculateChange: "بقیہ رقم نکالنے کے لیے رقم لکھیں",
  insufficientPayment: "ادائیگی ناکافی ہے",
  remaining: "باقی",
  completeSale: "سیل مکمل کریں",
  completing: "مکمل ہو رہا ہے…",
  checkout: "چیک آؤٹ",
  inCart: "کارٹ میں",
  insufficientNote:
    "ادائیگی کی رقم ناکافی ہے — سیل مکمل کرنے کے لیے باقی رقم وصول کریں۔",
  onlineNote: "گاہک آن لائن ٹرانسفر سے ادائیگی کرے گا۔ پوری رقم درج ہوگی — کوئی بقیہ رقم نہیں۔",
  // success
  saleComplete: "سیل مکمل!",
  thanksRecorded: "شکریہ — لین دین محفوظ ہو گیا ہے۔",
  preparing: "تیار ہو رہا ہے…",
  newSale: "نئی سیل",
  printReceipt: "رسید پرنٹ کریں",
  // reprint
  reprintLast: "پچھلی رسید",
  reprintTitle: "پچھلی رسید دوبارہ پرنٹ کریں",
  reprintEmpty: "ابھی تک کوئی رسید نہیں چھپی۔",
};

/** Translate a key for the active language. Falls back to English. */
export function tFor(lang: Lang) {
  return (key: keyof typeof UR | string): string => {
    if (lang === "ur") return UR[key] ?? key;
    return EN[key] ?? key;
  };
}

const EN: Record<string, string> = {
  posTitle: "POS — New Sale",
  posFlow: "Enter Product ID → Add → Payment → Complete Sale",
  tipQuickAdd: "Tip: “101*3” adds 3 at once",
  today: "Today",
  sale: "sale",
  sales: "sales",
  item: "item",
  items: "items",
  itemsSold: "sold",
  productId: "Product ID",
  add: "Add",
  searchPlaceholder: "Or search by product name…  ( / )",
  all: "All",
  available: "Available",
  pressEnterOrAdd: "Press Enter or ADD",
  noProductFound: "No product found with this ID — check and try again.",
  loadingProducts: "Loading products…",
  noProductsMatch: "No products match your search.",
  currentSale: "Current Sale",
  cartEmpty: "Cart is empty",
  cartEmptyHint: "Enter a Product ID or tap a product tile to start",
  hold: "Hold",
  clear: "Clear",
  parkedOrders: "Parked orders",
  resume: "Resume this order",
  subtotal: "Subtotal",
  total: "Total",
  discount: "Discount",
  discountApplied: "Discount applied —",
  off: "off",
  max: "Max",
  maxStock: "Max stock",
  each: "each",
  cash: "Cash",
  online: "Online",
  customerGives: "Customer Gives",
  exact: "Exact",
  change: "Change",
  enterAmountToCalculateChange: "Enter amount to calculate change",
  insufficientPayment: "Insufficient payment",
  remaining: "Remaining",
  completeSale: "Complete Sale",
  completing: "Completing…",
  checkout: "Checkout",
  inCart: "in cart",
  insufficientNote:
    "Payment amount is insufficient — collect the remaining amount to complete the sale.",
  onlineNote:
    "The customer pays by Online transfer. The full amount will be recorded — no change needed.",
  saleComplete: "Sale complete!",
  thanksRecorded: "Thank you — the transaction has been recorded.",
  preparing: "Preparing…",
  newSale: "New Sale",
  printReceipt: "Print Receipt",
  reprintLast: "Last receipt",
  reprintTitle: "Reprint last receipt",
  reprintEmpty: "No receipt printed yet.",
};

/** Convenience hook: `const { t, lang, toggle } = useT()` */
export function useT() {
  const lang = useLang((s) => s.lang);
  const toggle = useLang((s) => s.toggle);
  return { t: tFor(lang), lang, toggle, isUr: lang === "ur" };
}
