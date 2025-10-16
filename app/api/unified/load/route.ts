import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/lib/auth";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    // ✅ 로그인 쿠키 인증
    const token = cookies().get("token")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user?.username) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }

    // ✅ 사용자별 unified_rows 데이터 조회
    const sql = `
      SELECT data
      FROM unified_rows
      WHERE username = $1
      ORDER BY id DESC
      LIMIT 500
    `;
    const r = await query(sql, [user.username]);

    // ✅ data 필드 펼치기
    const flatRows = r.rows.flatMap(row =>
      Array.isArray(row.data) ? row.data : []
    );

    return NextResponse.json(flatRows);
  } catch (e) {
    console.error("unified/load error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

