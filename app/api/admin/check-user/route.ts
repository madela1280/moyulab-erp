import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const r = await query(
      `SELECT username, salt, password_hash FROM users WHERE username='medela1280'`
    );
    return NextResponse.json({ ok: true, rows: r.rows });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
