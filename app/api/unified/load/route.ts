import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/lib/auth";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    // 쿠키에서 로그인 사용자 인증
    const token = cookies().get("token")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user?.username) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }

    // 로그인된 사용자 기준으로 데이터 로드
    const sql = `
      SELECT * 
      FROM unified_rows
      WHERE username = $1
      ORDER BY id DESC
      LIMIT 500
    `;
    const r = await query(sql, [user.username]);

    return NextResponse.json({ ok: true, rows: r.rows });
  } catch (e) {
    console.error("unified/load error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
