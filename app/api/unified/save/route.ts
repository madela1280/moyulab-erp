import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/lib/auth";
import { query } from "@/app/lib/db";

/**
 * POST /api/unified/save
 * 통합관리 데이터 저장 (username별)
 */
export async function POST(req: Request) {
  try {
    // 로그인 쿠키 확인
    const token = cookies().get("token")?.value;
    if (!token) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
    }

    const user = verifyToken(token);
    if (!user?.username) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }

    // 요청 데이터 파싱
    const body = await req.json();
    const { rows } = body;

    if (!Array.isArray(rows)) {
      return NextResponse.json({ ok: false, error: "invalid_rows" }, { status: 400 });
    }

    // DB에 저장: 기존 데이터 삭제 후 새 데이터 삽입
    await query(`DELETE FROM unified_rows WHERE username = $1`, [user.username]);
    await query(`INSERT INTO unified_rows (data, username) VALUES ($1, $2)`, [
      JSON.stringify(rows),
      user.username,
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("unified/save error:", e);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}
