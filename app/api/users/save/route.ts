// app/api/users/save/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

type UserIn = {
  username: string;
  password?: string;   // 변경 시만 전달(빈문자/undefined면 비번 유지)
  role?: "admin" | "user";
  name?: string;
  phone?: string;
};
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { users: UserIn[] };
    if (!body?.users || !Array.isArray(body.users)) {
      return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
    }

    for (const u of body.users) {
      if (!u.username) continue;

      // 행 없으면 미리 생성
      await query(`INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`, [u.username]);

      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;

      if (u.name !== undefined)  { sets.push(`name=$${i++}`);  params.push(u.name); }
      if (u.phone !== undefined) { sets.push(`phone=$${i++}`); params.push(u.phone); }
      if (u.role !== undefined)  { sets.push(`role=$${i++}`);  params.push(u.role); }

      if (u.password !== undefined && u.password !== "") {
        const salt = crypto.randomBytes(8).toString("hex");
        const hash = sha256(`${salt}|${u.password}`);
        sets.push(`salt=$${i++}`);          params.push(salt);
        sets.push(`password_hash=$${i++}`); params.push(hash);
        // 레거시 password는 더 이상 사용하지 않음(원하면 NULL 처리 가능)
      }

      if (sets.length > 0) {
        params.push(u.username);
        await query(`UPDATE users SET ${sets.join(", ")} WHERE username=$${i}`, params);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
