import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/lib/auth";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const token = cookies().get("token")?.value;
    if (!token)
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });

    const user = verifyToken(token);
    if (!user?.username)
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });

    // ✅ unified_rows 테이블 보장
    await query(`
      CREATE TABLE IF NOT EXISTS unified_rows (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        data JSONB,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ✅ 데이터 불러오기
    const r = await query(
      `SELECT data FROM unified_rows WHERE username=$1 ORDER BY id DESC LIMIT 1`,
      [user.username]
    );

    const rows = Array.isArray(r.rows?.[0]?.data)
      ? r.rows[0].data
      : Array.from({ length: 20 }, () => ({})); // ← 비어 있으면 기본 20행 생성

    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    console.error("unified/load error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}




