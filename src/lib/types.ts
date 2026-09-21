// Shared types for Red Ribbons POS

export type Role = "OWNER" | "SALESMAN";

export interface SessionUser {
  username: string;
  name: string;
  role: Role;
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
  topItems: ReportTopItem[];
}

export interface Stats {
  todaySales: number;
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
  report: DayReport;
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
