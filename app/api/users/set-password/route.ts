import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const { username, current, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    const r = await query(
      `SELECT salt, password_hash FROM users WHERE username=$1 LIMIT 1`,
      [username]
    );
    if (r.rows.length === 0)
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

    const u = r.rows[0];
    const check = sha256(`${u.salt}|${current || ""}`);
    if (u.password_hash && current && check !== u.password_hash) {
      return NextResponse.json({ ok: false, error: "wrong_current" }, { status: 403 });
    }

    const newHash = sha256(`${u.salt}|${password}`);

    await query(
      `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE username=$2`,
      [newHash, username]
    );

    return NextResponse.json({ ok: true, message: "password_changed" });
  } catch (e) {
    console.error("set-password error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

