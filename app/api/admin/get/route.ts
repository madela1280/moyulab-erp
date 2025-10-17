import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const sql = `
      SELECT username, name, phone
      FROM users
      WHERE username = 'medela1280'
      LIMIT 1
    `;
    const result = await query(sql);
    if (!result.rows.length) {
      return NextResponse.json({ ok: false, error: "not_found" });
    }
    return NextResponse.json({ ok: true, row: result.rows[0] });
  } catch (e) {
    console.error("admin/get error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

