import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import crypto from "crypto";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ ok: false, message: "missing" }, { status: 400 });
    }

    // 기존 salt 조회
    const r = await query("SELECT salt FROM users WHERE username=$1 LIMIT 1", [username]);
    if (r.rows.length === 0) {
      return NextResponse.json({ ok: false, message: "user_not_found" }, { status: 404 });
    }

    const salt = r.rows[0].salt;
    const newHash = sha256(`${salt}|${password}`);

    await query(
      `UPDATE users 
         SET password_hash=$1, updated_at=NOW()
       WHERE username=$2`,
      [newHash, username]
    );

    return NextResponse.json({ ok: true, message: "비밀번호 변경 완료" });
  } catch (err) {
    console.error("admin/set-password error:", err);
    return NextResponse.json({ ok: false, message: "server_error" }, { status: 500 });
  }
}


