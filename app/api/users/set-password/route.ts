// app/api/users/set-password/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

type ReqBody = { username: string; current?: string; password: string };

// 규칙 유지: SHA-256( salt + '|' + password )
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    // 1) 사용자 조회
    const sel = await query(
      `SELECT username, password_hash, salt FROM users WHERE username = $1 LIMIT 1`,
      [body.username]
    );
    if (sel.rows.length === 0) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const u = sel.rows[0] as { username: string; password_hash: string | null; salt: string | null };

    // 2) 기존 비번이 있는 경우, current 검증
    if (u.password_hash && u.salt) {
      if (!body.current) {
        return NextResponse.json({ ok: false, error: "need_current" }, { status: 403 });
      }
      const check = sha256(`${u.salt}|${body.current}`);
      if (check !== u.password_hash) {
        return NextResponse.json({ ok: false, error: "wrong_current" }, { status: 403 });
      }
    }

      // 3) 새 비번 저장 (로그인 규칙과 동일하게 salt 고정)
      const newSalt = 'salt1234';
      const newHash = sha256(`${newSalt}|${body.password}`);

    await query(
      `UPDATE users
          SET password_hash = $1,
              salt = $2,
              updated_at = NOW()
        WHERE username = $3`,
      [newHash, newSalt, body.username]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("set-password error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

