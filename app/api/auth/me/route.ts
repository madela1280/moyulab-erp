// app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { verifyToken } from "@/app/lib/auth";

export async function GET(req: Request) {
  try {
    const token = req.headers.get("cookie")?.split("token=")[1]?.split(";")[0];
    if (!token) {
      return NextResponse.json({ ok: false, error: "no_token" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: payload });
  } catch (e) {
    console.error("auth/me error:", e);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
}
