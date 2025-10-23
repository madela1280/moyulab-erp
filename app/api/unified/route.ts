import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// ✅ DB에서 데이터 가져오기
export async function GET() {
  try {
    const result = await query("SELECT data FROM unified WHERE id = 1");
    const rows = result.rows.length ? result.rows[0].data : [];
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ GET /api/unified error:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}

// ✅ DB에 데이터 저장하기
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows } = body;

    await query("UPDATE unified SET data = $1 WHERE id = 1", [JSON.stringify(rows)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ POST /api/unified error:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}
