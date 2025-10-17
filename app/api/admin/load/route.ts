import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const r = await query(`SELECT name, phone FROM admin_info ORDER BY id DESC LIMIT 1`);
    return NextResponse.json({ ok: true, admin: r.rows[0] || null });
  } catch (e) {
    console.error("admin/load error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
