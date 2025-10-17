import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/app/lib/auth";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const token = cookies().get("token")?.value;
    if (!token) return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });

    const user = verifyToken(token);
    if (!user?.username) return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });

    const r = await query(
      `SELECT data FROM unified_rows WHERE username=$1 ORDER BY id DESC LIMIT 1`,
      [user.username]
    );

    const rows = r.rows?.[0]?.data ?? [];
    return NextResponse.json({ ok: true, rows });
  } catch (e) {
    console.error("unified/load error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}



