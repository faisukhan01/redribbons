import { db } from "@/lib/db";

/**
 * Idempotent seeding — runs once when the database is empty.
 * Populates realistic Red Ribbons bakery data: users, products and a few
 * sample sales from today so the owner dashboard shows live numbers.
 */

const USERS = [
  { username: "abdullah", name: "Abdullah", role: "OWNER", pin: "1234" },
  { username: "ahmed", name: "Ahmed", role: "SALESMAN", pin: "1111" },
];

const PRODUCTS: Array<[string, string, string, number, number]> = [
  // [productId, name, category, price, stock]
  ["101", "Fresh Bread", "Bakery", 120, 50],
  ["102", "Milk Bread", "Bakery", 150, 40],
  ["103", "Sandwich Bread", "Bakery", 180, 30],
  ["104", "Whole Wheat Bread", "Bakery", 200, 25],
  ["105", "Bun", "Bakery", 40, 100],
  ["106", "Burger Bun", "Bakery", 60, 80],
  ["107", "Croissant", "Bakery", 150, 35],
  ["108", "Rusk", "Bakery", 100, 60],
  ["109", "Cookies (Pack)", "Bakery", 250, 45],
  ["201", "Chocolate Cake (1 lb)", "Cakes", 1200, 10],
  ["202", "Vanilla Cake (1 lb)", "Cakes", 1000, 12],
  ["203", "Red Velvet Cake (1 lb)", "Cakes", 1500, 8],
  ["204", "Pineapple Cake (1 lb)", "Cakes", 1100, 9],
  ["205", "Black Forest Cake (1 lb)", "Cakes", 1300, 4],
  ["206", "Fresh Cream Cake (1 lb)", "Cakes", 950, 11],
  ["301", "Gulab Jamun", "Sweets", 500, 20],
  ["302", "Rasgulla", "Sweets", 450, 18],
  ["303", "Barfi", "Sweets", 600, 22],
  ["304", "Besan Barfi", "Sweets", 550, 16],
  ["305", "Milk Cake", "Sweets", 700, 14],
  ["306", "Jalebi", "Sweets", 400, 25],
  ["307", "Gajar Halwa", "Sweets", 800, 3],
  ["401", "Chicken Patties", "Snacks", 180, 35],
  ["402", "Vegetable Patties", "Snacks", 120, 40],
  ["403", "Chicken Samosa", "Snacks", 90, 50],
  ["404", "Vegetable Samosa", "Snacks", 70, 45],
  ["405", "Chicken Roll", "Snacks", 160, 30],
  ["406", "Chicken Sandwich", "Snacks", 250, 20],
  ["407", "Pizza Slice", "Snacks", 300, 24],
];

// Deterministic demo sales for today: [productId, qty, method, received]
const DEMO_SALES: Array<[string, number, "CASH" | "ONLINE", number | null]> = [
  ["101", 2, "CASH", 500],
  ["401", 3, "CASH", 1000],
  ["201", 1, "ONLINE", null],
  ["105", 5, "CASH", 500],
  ["301", 1, "CASH", 500],
  ["407", 2, "ONLINE", null],
  ["107", 2, "CASH", 500],
  ["303", 1, "CASH", 1000],
];

function pad6(n: number): string {
  return `RR-${String(n).padStart(6, "0")}`;
}

let seedPromise: Promise<void> | null = null;

export function ensureSeed(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function doSeed(): Promise<void> {
  const userCount = await db.user.count();
  if (userCount > 0) return;

  await db.user.createMany({ data: USERS });

  const created: Record<string, { id: number; price: number; stock: number; sold: number }> = {};
  for (const [code, name, category, price, stock] of PRODUCTS) {
    const p = await db.product.create({
      data: { productId: code, name, category, price, stock },
    });
    created[code] = { id: p.id, price, stock, sold: 0 };
  }

  // A handful of demo sales recorded earlier today
  let saleNo = 1;
  for (const [code, qty, method, received] of DEMO_SALES) {
    const p = created[code];
    if (!p) continue;
    const subtotal = p.price * qty;
    const change = method === "CASH" && received != null ? received - subtotal : 0;
    await db.sale.create({
      data: {
        saleId: pad6(saleNo++),
        salesman: "Ahmed",
        total: subtotal,
        paymentMethod: method,
        amountReceived: method === "CASH" ? received : subtotal,
        changeReturned: change,
        items: {
          create: {
            productId: p.id,
            name: PRODUCTS.find((x) => x[0] === code)?.[1] ?? "Item",
            quantity: qty,
            price: p.price,
            subtotal,
          },
        },
      },
    });
    p.stock -= qty;
    p.sold += qty;
    await db.product.update({
      where: { id: p.id },
      data: { stock: p.stock, soldQuantity: p.sold },
    });
  }
}
