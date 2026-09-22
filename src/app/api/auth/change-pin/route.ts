import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

// POST /api/auth/change-pin — { username, currentPin, newPin }
export async function POST(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);
    const username = String(body?.username ?? "").trim();
    const currentPin = String(body?.currentPin ?? "").trim();
    const newPin = String(body?.newPin ?? "").trim();

    if (!username) {
      return NextResponse.json({ error: "Missing user." }, { status: 400 });
    }
    if (!/^\d{4,6}$/.test(currentPin)) {
      return NextResponse.json(
        { error: "Enter your current PIN (4–6 digits)." },
        { status: 400 }
      );
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      return NextResponse.json(
        { error: "New PIN must be 4–6 digits." },
        { status: 400 }
      );
    }
    if (newPin === currentPin) {
      return NextResponse.json(
        { error: "The new PIN must be different from the current one." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { username } });
    if (!user || user.pin !== currentPin) {
      return NextResponse.json(
        { error: "Current PIN is incorrect." },
        { status: 401 }
      );
    }

    await db.user.update({ where: { username }, data: { pin: newPin } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("change-pin error", err);
    return NextResponse.json(
      { error: "Could not change the PIN right now." },
      { status: 500 }
    );
  }
}
