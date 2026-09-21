import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";
import type { Role } from "@/lib/types";

export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);
    const role = String(body?.role ?? "").toUpperCase();
    const pin = String(body?.pin ?? "").trim();

    if (role !== "OWNER" && role !== "SALESMAN") {
      return NextResponse.json({ error: "Please select a role." }, { status: 400 });
    }
    if (!pin) {
      return NextResponse.json({ error: "Please enter your PIN." }, { status: 400 });
    }

    const user = await db.user.findFirst({ where: { role: role as Role, pin } });
    if (!user) {
      return NextResponse.json(
        { error: "Incorrect PIN. Please try again." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: { username: user.username, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("login error", err);
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 500 }
    );
  }
}
