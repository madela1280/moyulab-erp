import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/lib/auth";
import { query } from "@/app/lib/db";

export async function POST(req: Request) {
  try {
    const token = cookies().get("token")?.value;
    if (!token)
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });

    const user = verifyToken(token);
    if (!user?.username)
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });

    const { rows } = await req.json();
    if (!Array.isArray(rows))
      return NextResponse.json({ ok: false, error: "invalid_rows" }, { status: 400 });

    // ✅ 테이블 보장
    await query(`
      CREATE TABLE IF NOT EXISTS unified_rows (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255),
        data JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // ✅ 사용자별 최신 데이터로 갱신
    await query(`DELETE FROM unified_rows WHERE username = $1`, [user.username]);
    await query(
      `INSERT INTO unified_rows (username, data) VALUES ($1, $2)`,
      [user.username, JSON.stringify(rows)]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("unified/save error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

