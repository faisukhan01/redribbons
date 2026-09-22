import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic"; // session data must never be cached/prerendered

// GET /api/auth/session?role=OWNER|SALESMAN
// Returns the CURRENT account for a role so devices holding an old persisted
// session (localStorage) can silently refresh renamed profile fields — e.g.
// the salesman display name — without forcing a re-login. Single-counter
// POS: consistent with the existing API surface (no session tokens).
export async function GET(req: Request) {
  try {
    await ensureSeed();
    const role = new URL(req.url).searchParams.get("role")?.toUpperCase();

    if (role !== "OWNER" && role !== "SALESMAN") {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { role: role as Role } });
    if (!user) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    return NextResponse.json({
      user: { username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("session error", err);
    return NextResponse.json(
      { error: "Unable to load session right now." },
      { status: 500 }
    );
  }
}
