import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const result = await query("SELECT NOW()");
    return NextResponse.json({
      ok: true,
      message: "✅ DB 연결 성공!",
      server_time: result.rows[0].now,
    });
  } catch (err) {
    console.error("❌ DB 연결 오류:", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
