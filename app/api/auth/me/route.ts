import { NextResponse } from "next/server";
import { cookies } from "next/headers";   // ✅ async cookies() 사용
import { verifyToken } from "@/lib/auth";
import { query } from "@/lib/db";

export async function GET(req: Request) {
  try {
    // ✅ 쿠키에서 토큰 추출 (Next.js 15 async 대응)
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded || typeof decoded !== "object" || !("username" in decoded)) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }

    const sql = `
      SELECT username, role, name, phone
      FROM users
      WHERE username = $1
      LIMIT 1
    `;
    const r = await query(sql, [(decoded as any).username]);

    if (r.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, user: r.rows[0] });
  } catch (e) {
    console.error("❌ auth/me error:", e);
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
  }
}


