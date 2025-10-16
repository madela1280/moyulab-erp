// app/api/test-db/route.ts
import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const r = await query(`
      SELECT username, salt, password_hash, updated_at
      FROM users
      ORDER BY updated_at DESC
      LIMIT 5;
    `);
    return NextResponse.json({ ok: true, rows: r.rows });
  } catch (e) {
    console.error("DB test error:", e);
    return NextResponse.json({ ok: false, error: "db_error" });
  }
}
