import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/** 🔹 GET: DB 불러오기 */
export async function GET() {
  try {
    const result = (await query(
      "SELECT data FROM unified WHERE id = 1",
      []
    )) as unknown as {
      rows: { data: any }[];
    };

    const rows = result.rows.length ? result.rows[0].data : [];
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ GET unified error:", err);
    return NextResponse.json(
      { ok: false, error: "db_error" },
      { status: 500 }
    );
  }
}

/** 🔹 POST: DB 저장 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows } = body;

    await query("UPDATE unified SET data = $1 WHERE id = 1", [
      JSON.stringify(rows),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ POST unified error:", err);
    return NextResponse.json(
      { ok: false, error: "db_error" },
      { status: 500 }
    );
  }
}




