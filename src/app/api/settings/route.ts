import { NextResponse } from "next/server";
import { getSettings, saveSettings } from "@/lib/app-settings";

// GET /api/settings — return current settings
export async function GET() {
  try {
    const settings = await getSettings();
    return NextResponse.json(settings);
  } catch (err) {
    console.error("[settings GET]", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

// POST /api/settings — persist partial updates
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Coerce every value to string for the key-value store
    const partial: Record<string, string> = {};
    for (const [key, val] of Object.entries(body)) {
      if (val === null || val === undefined) {
        partial[key] = "null";
      } else if (Array.isArray(val)) {
        partial[key] = JSON.stringify(val);
      } else {
        partial[key] = String(val);
      }
    }

    await saveSettings(partial);
    const updated = await getSettings();
    return NextResponse.json(updated);
  } catch (err) {
    console.error("[settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
