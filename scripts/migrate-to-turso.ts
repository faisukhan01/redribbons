/**
 * One-shot migration: local SQLite  →  Turso (libSQL)
 *
 * 1. Applies the Prisma-generated DDL to Turso (skipped if tables exist).
 * 2. Copies every row from the local database, preserving primary keys,
 *    in FK-safe order (User, Product, Sale, SaleItem, Setting, Order).
 * 3. Renames the OWNER user to "Abaid Ullah".
 *
 * Usage: bun scripts/migrate-to-turso.ts
 */
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const SRC_URL = "file:/home/z/my-project/db/custom.db";
const src = createClient({ url: SRC_URL });

const dstUrl = process.env.TURSO_DATABASE_URL;
const dstToken = process.env.TURSO_AUTH_TOKEN;
if (!dstUrl) {
  console.error("TURSO_DATABASE_URL is not set (.env)");
  process.exit(1);
}
const dst = createClient({ url: dstUrl, authToken: dstToken });

// ---------------------------------------------------------------- schema
const existing = await dst.execute(`SELECT name FROM sqlite_master WHERE type='table' AND name='rr_users'`);
if (existing.rows.length === 0) {
  const ddl = readFileSync("scripts/turso_schema.sql", "utf8");
  await dst.executeMultiple(ddl);
  console.log("✓ schema created on Turso");
} else {
  console.log("• schema already exists on Turso — skipping DDL");
}

// ---------------------------------------------------------------- copy data
// Parent tables first so FK constraints hold.
// Local source tables keep their original names; Turso tables are rr_-prefixed.
const MAP: Array<[string, string]> = [
  ["User", "rr_users"],
  ["Product", "rr_products"],
  ["Sale", "rr_sales"],
  ["SaleItem", "rr_sale_items"],
  ["Setting", "rr_settings"],
  ["Order", "rr_orders"],
];

// Prisma's libsql driver adapter writes/compares DateTime as ISO-8601 TEXT,
// while the native local engine stores epoch-millis INTEGER. Convert on copy
// so `where: { createdAt: { gte } }` style queries match correctly.
const DATETIME_COLS: Record<string, string[]> = {
  rr_users: ["createdAt"],
  rr_products: ["createdAt", "updatedAt"],
  rr_sales: ["createdAt"],
  rr_sale_items: [],
  rr_settings: ["updatedAt"],
  rr_orders: ["dueAt", "createdAt", "updatedAt"],
};

function toIso(v: unknown): unknown {
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  if (typeof v === "bigint") return new Date(Number(v)).toISOString();
  if (typeof v === "string" && v !== "") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return v;
}

// Wipe destination rows — children first to keep FK constraints happy
for (const [, t] of [...MAP].reverse()) {
  await dst.execute(`DELETE FROM "${t}"`);
}

// Copy in parent-first order
for (const [srcName, table] of MAP) {
  const rows = await src.execute(`SELECT * FROM "${srcName}"`);
  if (rows.rows.length === 0) {
    console.log(`• ${table}: 0 rows`);
    continue;
  }

  const cols = Object.keys(rows.rows[0]);
  const dateCols = DATETIME_COLS[table] ?? [];
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols.map(() => "?").join(", ");

  const statements = rows.rows.map((row) => ({
    sql: `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
    args: cols.map((c) => {
      const v = (row as Record<string, unknown>)[c];
      if (dateCols.includes(c)) return v == null ? null : toIso(v);
      if (v == null) return null;
      if (typeof v === "bigint") return Number(v);
      if (typeof v === "boolean") return v ? 1 : 0;
      if (typeof v === "object" && v !== null && "toString" in v) return String(v);
      return v as string | number;
    }),
  }));

  await dst.batch(statements, "write");
  console.log(`✓ ${table}: ${rows.rows.length} rows copied`);
}

// ---------------------------------------------------------------- rename owner
await dst.execute(
  `UPDATE "rr_users" SET username = 'abaid', name = 'Abaid Ullah' WHERE role = 'OWNER'`
);
const owner = await dst.execute(`SELECT username, name, role FROM "rr_users" WHERE role = 'OWNER'`);
console.log("✓ owner:", JSON.stringify(owner.rows[0]));

// ---------------------------------------------------------------- verify
console.log("\n--- Turso verification ---");
for (const [, t] of MAP) {
  const r = await dst.execute(`SELECT COUNT(*) AS c FROM "${t}"`);
  console.log(`${t}: ${Number(r.rows[0].c)}`);
}
const sale = await dst.execute(`SELECT saleId, salesman, total FROM "rr_sales" ORDER BY id DESC LIMIT 1`);
console.log("lastSale:", JSON.stringify(sale.rows[0]));
