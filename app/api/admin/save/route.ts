// app/api/admin/save/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

type ReqBody = { password: string };

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.password) {
      return NextResponse.json({ ok: false, error: "missing_password" }, { status: 400 });
    }

    const salt = crypto.randomBytes(8).toString("hex");
    const passwordHash = sha256(`${salt}|${body.password}`);

    await query(
      `INSERT INTO users (username, password, role, name, phone, password_hash, salt)
       VALUES ('medela1280', '__legacy__', 'admin', '관리자', '000-0000-0000', $1, $2)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             salt = EXCLUDED.salt,
             role = 'admin'`,
      [passwordHash, salt]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin/save error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

