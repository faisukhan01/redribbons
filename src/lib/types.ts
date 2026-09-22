// Shared types for Red Ribbons POS

export type Role = "OWNER" | "SALESMAN";

export interface SessionUser {
  username: string;
  name: string;
  role: Role;
}

/**
 * The name to show in the UI / stamp on records. The salesman account is
 * ALWAYS displayed as the generic "Salesman" — never a personal name — even
 * if a device still holds an old persisted session (localStorage) with a
 * stale name. The owner keeps their real name.
 */
export function displayName(user: Pick<SessionUser, "name" | "role">): string {
  return user.role === "SALESMAN" ? "Salesman" : user.name;
}

export interface Product {
  id: number;
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  soldQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItemDTO {
  id: number;
  saleId: number;
  productId: number;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Sale {
  id: number;
  saleId: string;
  salesman: string;
  total: number;
  discount: number;
  paymentMethod: "CASH" | "ONLINE";
  amountReceived: number | null;
  changeReturned: number | null;
  createdAt: string;
  items: SaleItemDTO[];
}

export interface CartItem {
  productId: number; // internal DB id
  code: string; // human-facing product id e.g. "101"
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

export interface TrendPoint {
  /** YYYY-MM-DD in the client's timezone */
  date: string;
  /** Short weekday label, e.g. "Mon" */
  label: string;
  total: number;
  count: number;
}

/** Best seller row (all-time units sold, from Product.soldQuantity). */
export interface TopProduct {
  id: number;
  productId: string;
  name: string;
  category: string;
  price: number;
  soldQuantity: number;
}

/** Aggregated item line for today's end-of-day report. */
export interface ReportTopItem {
  name: string;
  quantity: number;
  revenue: number;
}

/** Extra figures for the printable end-of-day (Z) report. */
export interface DayReport {
  cashCount: number;
  onlineCount: number;
  changeGiven: number;
  discountTotal: number;
  topItems: ReportTopItem[];
}

/** One row of the "staff sales today" breakdown. */
export interface StaffSalesRow {
  salesman: string;
  count: number;
  total: number;
}

/** Owner-editable shop info that prints on receipts. */
export interface ShopSettings {
  shopPhone: string;
  shopAddress: string;
  receiptNote: string;
  /** Thermal paper roll width in mm — "80" (default) or "58" for compact printers. */
  paperWidth: string;
}

/* ------------------------------------------------------------------ */
/* Pre-orders / orders on call                                         */
/* ------------------------------------------------------------------ */

export type OrderStatus = "PENDING" | "READY" | "DONE" | "CANCELLED";

/** One item line of a pre-order (snapshot taken at order time). */
export interface OrderLine {
  /** Human-facing product code, e.g. "205" */
  code: string;
  /** Product name snapshot */
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Order {
  id: number;
  orderId: string; // e.g. "RO-000012"
  customerName: string;
  customerPhone: string;
  items: OrderLine[];
  total: number;
  /** Partial payment taken at booking time (Rs). Balance = total - advance. */
  advance: number;
  status: OrderStatus;
  dueAt: string | null; // ISO timestamp of the requested pickup time
  note: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  todaySales: number;
  yesterdayTotal: number;
  salesTodayCount: number;
  cashToday: number;
  onlineToday: number;
  itemsSoldToday: number;
  productsCount: number;
  stockAvailable: number;
  stockValue: number;
  lowStock: Product[];
  recentSales: Sale[];
  trend: TrendPoint[];
  topProducts: TopProduct[];
  staffToday: StaffSalesRow[];
  report: DayReport;
  /** Pre-orders that are still PENDING or READY (all-time open book). */
  ordersPending: number;
  /** Next pending pickup (ISO) or null. */
  ordersNextDue: string | null;
}

/** Snapshot file written by /api/backup (GET) and consumed by restore (POST). */
export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  products: Array<{
    productId: string;
    name: string;
    category: string;
    price: number;
    stock: number;
    soldQuantity: number;
  }>;
  sales: Array<{
    saleId: string;
    salesman: string;
    total: number;
    discount?: number;
    paymentMethod: string;
    amountReceived: number | null;
    changeReturned: number | null;
    createdAt: string;
    items: Array<{
      productId: string;
      name: string;
      quantity: number;
      price: number;
      subtotal: number;
    }>;
  }>;
  settings?: Record<string, string>;
  orders?: Array<{
    orderId: string;
    customerName: string;
    customerPhone: string;
    items: Array<{ code: string; name: string; quantity: number; price: number; subtotal: number }>;
    total: number;
    advance?: number;
    status: string;
    dueAt: string | null;
    note: string;
    createdBy: string;
    createdAt: string;
  }>;
}

export interface ImportRow {
  productId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

export interface ImportSkip {
  row: number;
  reason: string;
}

export interface ImportResult {
  imported: number;
  skipped: ImportSkip[];
}
