import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    // ✅ 두 번째 인자 [] 추가
    const result = await query("SELECT NOW()", []);

    return NextResponse.json({
      ok: true,
      message: "✅ DB 연결 성공!",
      time: result.rows[0].now,
    });
  } catch (err) {
    console.error("❌ DB 연결 테스트 실패:", err);
    return NextResponse.json(
      { ok: false, error: "db_connection_failed" },
      { status: 500 }
    );
  }
}

