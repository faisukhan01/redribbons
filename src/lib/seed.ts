import { db } from "@/lib/db";

/**
 * Idempotent bootstrap — runs once when the database is empty.
 * Creates ONLY the default staff accounts so the counter can log in.
 * Products, sales and pre-orders are real business data — the system
 * starts completely empty and the shop fills them in themselves.
 */

const USERS = [
  { username: "abaid", name: "Abaid Ullah", role: "OWNER", pin: "1234" },
  { username: "salesman", name: "Salesman", role: "SALESMAN", pin: "1111" },
];

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
}
