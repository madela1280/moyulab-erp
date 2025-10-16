import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

type ReqBody = { username: string; current?: string; password: string };
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    // 🔹 사용자 조회
    const sel = await query(
      `SELECT username, password_hash, salt FROM users WHERE username = $1 LIMIT 1`,
      [body.username]
    );
    if (sel.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const u = sel.rows[0] as { username: string; password_hash: string | null; salt: string | null };
    if (!u.salt) {
      return NextResponse.json({ ok: false, error: "no_salt" }, { status: 500 });
    }

    // 🔹 기존 비밀번호 검증 (있을 때만)
    if (u.password_hash && body.current) {
      const check = sha256(`${u.salt}|${body.current}`);
      if (check !== u.password_hash) {
        return NextResponse.json({ ok: false, error: "wrong_current" }, { status: 403 });
      }
    }

    // 🔹 기존 salt 재사용 (새 salt 생성 금지)
    const newHash = sha256(`${u.salt}|${body.password}`);

    await query(
      `UPDATE users
          SET password_hash = $1,
              updated_at = NOW()
        WHERE username = $2`,
      [newHash, body.username]
    );

    return NextResponse.json({ ok: true, message: "password_changed" });
  } catch (e) {
    console.error("users/set-password error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}


