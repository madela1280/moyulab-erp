// app/api/admin/save/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

const ADMIN_ID = "medela1280";
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { password?: string; name?: string; phone?: string };
    // 최소 한 개는 변경해야 함
    if (!body || (body.password ?? body.name ?? body.phone) === undefined) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    // 행 없으면 생성 + admin 역할
    await query(`INSERT INTO users (username, role) VALUES ($1,'admin') ON CONFLICT (username) DO NOTHING`, [ADMIN_ID]);

    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (body.name !== undefined)  { sets.push(`name=$${i++}`);  params.push(body.name); }
    if (body.phone !== undefined) { sets.push(`phone=$${i++}`); params.push(body.phone); }

    if (body.password !== undefined && body.password !== "") {
      const salt = crypto.randomBytes(8).toString("hex");
      const hash = sha256(`${salt}|${body.password}`);
      sets.push(`salt=$${i++}`);          params.push(salt);
      sets.push(`password_hash=$${i++}`); params.push(hash);
    }

    if (sets.length === 0) {
      return NextResponse.json({ ok: true, updated: false });
    }

    params.push(ADMIN_ID);
    await query(`UPDATE users SET ${sets.join(", ")} WHERE username=$${i}`, params);

    return NextResponse.json({ ok: true, updated: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
