import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, phone } = body;

    if (!name || !phone) {
      return NextResponse.json({ ok: false, error: "missing_fields" });
    }

    const sql = `
      UPDATE users
      SET name = $1, phone = $2
      WHERE username = 'medela1280'
    `;
    await query(sql, [name, phone]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/save error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}



