/**
 * Production data reset — removes ALL dummy/test business data
 * (products, sales, sale items, pre-orders, receipt settings) from the
 * Turso database AND the local fallback SQLite file, keeping only the
 * staff login accounts. Auto-increment counters are reset so the first
 * real product gets id 1 and the first real sale gets RR-000001.
 *
 * Usage: bun --env-file=.env scripts/reset-data.ts
 */
import { createClient } from "@libsql/client";

const BUSINESS_TABLES = ["rr_sale_items", "rr_sales", "rr_orders", "rr_products", "rr_settings"];
const SEQ_TABLES = ["rr_sale_items", "rr_sales", "rr_orders", "rr_products", "rr_settings"];

const targets: Array<{ label: string; url: string; authToken?: string }> = [];
if (process.env.TURSO_DATABASE_URL) {
  targets.push({
    label: "Turso",
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
}
targets.push({ label: "Local", url: "file:/home/z/my-project/db/custom.db" });

for (const t of targets) {
  const conn = createClient({ url: t.url, authToken: t.authToken });
  console.log(`\n=== ${t.label} (${t.url.slice(0, 40)}…) ===`);

  // Children first so FK constraints hold
  for (const table of BUSINESS_TABLES) {
    try {
      const r = await conn.execute(`DELETE FROM "${table}"`);
      console.log(`✓ wiped ${table} (${r.rowsAffected} rows)`);
    } catch (e) {
      console.log(`• ${table}: ${(e as Error).message.slice(0, 60)}`);
    }
  }

  // Reset auto-increment counters so IDs restart from 1
  for (const table of SEQ_TABLES) {
    try {
      await conn.execute({
        sql: `DELETE FROM sqlite_sequence WHERE name = ?`,
        args: [table],
      });
    } catch {
      /* sqlite_sequence may not exist yet — ignore */
    }
  }

  const users = await conn.execute(`SELECT COUNT(*) AS c FROM "rr_users"`);
  console.log(`✓ kept rr_users: ${Number(users.rows[0].c)} staff accounts`);
  const sales = await conn.execute(`SELECT COUNT(*) AS c FROM "rr_sales"`);
  const products = await conn.execute(`SELECT COUNT(*) AS c FROM "rr_products"`);
  const orders = await conn.execute(`SELECT COUNT(*) AS c FROM "rr_orders"`);
  console.log(`✓ now empty → sales: ${Number(sales.rows[0].c)}, products: ${Number(products.rows[0].c)}, orders: ${Number(orders.rows[0].c)}`);
}
console.log("\nData reset complete — system is production-clean. ✅");
