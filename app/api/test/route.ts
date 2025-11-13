import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query("SELECT NOW()", []);

    // ✅ 안전한 타입 변환
    const row = result.rows[0] as unknown as { now: string };

    return NextResponse.json({
      ok: true,
      message: "✅ DB 연결 성공!",
      time: row.now,
    });
  } catch (err) {
    console.error("❌ DB 연결 테스트 실패:", err);
    return NextResponse.json(
      { ok: false, error: "db_connection_failed" },
      { status: 500 }
    );
  }
}

// test