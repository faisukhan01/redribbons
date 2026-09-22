/**
 * One-off migration: the salesman account must display as "Salesman" only —
 * no personal name. Renames the staff record AND rewrites the name on any
 * existing sales / pre-orders so receipts, memos, history and Z-reports
 * all read "Salesman".
 *
 * Usage: bun --env-file=.env scripts/rename-salesman.ts
 */
import { createClient } from "@libsql/client";

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

  try {
    const r = await conn.execute({
      sql: `UPDATE "rr_users" SET name = 'Salesman', username = 'salesman'
            WHERE role = 'SALESMAN' AND (name <> 'Salesman' OR username <> 'salesman')`,
    });
    console.log(`✓ rr_users renamed (${r.rowsAffected} row/s)`);
  } catch (e) {
    console.log(`• rr_users: ${(e as Error).message.slice(0, 80)}`);
  }

  try {
    const r = await conn.execute({
      sql: `UPDATE "rr_sales" SET salesman = 'Salesman' WHERE salesman = 'Ahmed'`,
    });
    console.log(`✓ rr_sales salesman rewritten (${r.rowsAffected} row/s)`);
  } catch (e) {
    console.log(`• rr_sales: ${(e as Error).message.slice(0, 80)}`);
  }

  try {
    const r = await conn.execute({
      sql: `UPDATE "rr_orders" SET createdBy = 'Salesman' WHERE createdBy = 'Ahmed'`,
    });
    console.log(`✓ rr_orders createdBy rewritten (${r.rowsAffected} row/s)`);
  } catch (e) {
    console.log(`• rr_orders: ${(e as Error).message.slice(0, 80)}`);
  }

  try {
    const check = await conn.execute(`SELECT username, name, role FROM "rr_users"`);
    for (const row of check.rows) {
      console.log(`  → ${row.role}: ${row.name} (username: ${row.username})`);
    }
  } catch (e) {
    console.log(`• verify: ${(e as Error).message.slice(0, 80)}`);
  }
}
console.log("\nSalesman rename complete. ✅");
