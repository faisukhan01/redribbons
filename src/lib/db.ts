import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Production (Vercel) runs against a hosted Turso (libSQL) database —
 * set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in the environment.
 * Local development falls back to the file-based SQLite database
 * configured via DATABASE_URL in .env.
 */
function createDb(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    const adapter = new PrismaLibSQL({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN ?? "",
    });
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  }
  return new PrismaClient({ log: ["error", "warn"] });
}

export const db = globalForPrisma.prisma ?? createDb();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
