// app/api/admin/reset-password/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { query } from "@/app/lib/db";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

export async function POST() {
  try {
    const salt = "reset1234";
    const newPassword = "Reset!888";
    const hash = sha256(`${salt}|${newPassword}`);

    await query(
      `UPDATE users
       SET salt = $1,
           password_hash = $2,
           updated_at = NOW()
       WHERE username = 'medela1280'`,
      [salt, hash]
    );

    return NextResponse.json({ ok: true, message: "관리자 비밀번호 Reset!888 로 초기화 완료" });
  } catch (e) {
    console.error("reset-password error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
