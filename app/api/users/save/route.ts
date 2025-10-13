// app/api/users/save/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

type ReqBody = { username: string; password: string; role?: string; name?: string; phone?: string };

function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: "missing" }, { status: 400 });
    }

    const salt = crypto.randomBytes(8).toString("hex");
    const passwordHash = sha256(`${salt}|${body.password}`);

    await query(
      `INSERT INTO users (username, password, role, name, phone, password_hash, salt)
       VALUES ($1, '__legacy__', $2, $3, $4, $5, $6)
       ON CONFLICT (username) DO UPDATE
         SET password_hash = EXCLUDED.password_hash,
             salt = EXCLUDED.salt,
             role = EXCLUDED.role,
             name = EXCLUDED.name,
             phone = EXCLUDED.phone`,
      [body.username, body.role ?? "user", body.name ?? "", body.phone ?? "", passwordHash, salt]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("users/save error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}

