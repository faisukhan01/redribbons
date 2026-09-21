import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureSeed } from "@/lib/seed";

const ALLOWED = ["shopPhone", "shopAddress", "receiptNote", "paperWidth"] as const;
type SettingKey = (typeof ALLOWED)[number];

async function readSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.setting.findMany({ where: { key: { in: [...ALLOWED] } } });
  const out: Record<SettingKey, string> = {
    shopPhone: "",
    shopAddress: "",
    receiptNote: "",
    paperWidth: "80",
  };
  for (const row of rows) {
    if ((ALLOWED as readonly string[]).includes(row.key)) {
      out[row.key as SettingKey] = row.value;
    }
  }
  return out;
}

// GET /api/settings — receipt/shop info shown on printed receipts
export async function GET() {
  try {
    await ensureSeed();
    const settings = await readSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("settings read error", err);
    return NextResponse.json(
      { error: "Unable to load settings right now." },
      { status: 500 }
    );
  }
}

// PUT /api/settings — { settings: { shopPhone?, shopAddress?, receiptNote? } }
export async function PUT(req: Request) {
  try {
    await ensureSeed();
    const body = await req.json().catch(() => null);
    const incoming = body?.settings;
    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }

    const updates: Array<{ key: SettingKey; value: string }> = [];
    for (const key of ALLOWED) {
      if (incoming[key] === undefined) continue;
      let value = String(incoming[key] ?? "").trim().slice(0, 200); // receipt-safe length
      if (key === "paperWidth") value = value === "58" ? "58" : "80"; // only two sizes
      updates.push({ key, value });
    }

    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      });
    }

    const settings = await readSettings();
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("settings write error", err);
    return NextResponse.json(
      { error: "Could not save the settings right now." },
      { status: 500 }
    );
  }
}
