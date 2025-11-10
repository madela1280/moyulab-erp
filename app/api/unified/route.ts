import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSessionUser } from "@/lib/auth"; // ✅ 세션 유저 확인 함수 (login 쿠키 기반)

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const result = await query("SELECT data FROM unified WHERE id = 1");
    const rows = result.rows.length ? result.rows[0].data : [];
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ GET /api/unified error:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json();
    const { rows } = body;

    await query("UPDATE unified SET data = $1 WHERE id = 1", [JSON.stringify(rows)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ POST /api/unified error:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}
