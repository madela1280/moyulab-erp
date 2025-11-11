import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { Server } from "socket.io";

/** ✅ 전역 Socket 서버 (모든 브라우저 동기화 전용) */
let io: Server | null = null;
if (!(global as any).io) {
  const { createServer } = require("http");
  const express = require("express");
  const app = express();
  const httpServer = createServer(app);
  io = new Server(httpServer, { cors: { origin: "*" } });
  httpServer.listen(4001, () => console.log("✅ Realtime Socket Server :4001"));
  (global as any).io = io;
} else {
  io = (global as any).io;
}

/** 🔹 GET: DB 불러오기 */
export async function GET() {
  try {
    // ✅ 빌드 에러 방지: 두 번째 인자 [] 추가
    const result = (await query("SELECT data FROM unified WHERE id = 1", [])) as unknown as { rows: { data: any }[] };
    const rows = result.rows.length ? result.rows[0].data : [];
    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ GET unified error:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}

/** 🔹 POST: DB 저장 + 실시간 브로드캐스트 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { rows } = body;

   await query("UPDATE unified SET data = $1 WHERE id = 1", [JSON.stringify(rows)]);

// 🔹 Redis 브로드캐스트 추가 (모든 세션으로 실시간 전파)
try {
  const { createClient } = require("redis");
  const redis = createClient({ url: "redis://127.0.0.1:6379" });
  await redis.connect();
  await redis.publish("unified:update", JSON.stringify(rows));
  await redis.disconnect();
} catch (e) {
  console.error("❌ Redis publish error:", e);
}

if (io) io.emit("update", rows);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("❌ POST unified error:", err);
    return NextResponse.json({ ok: false, error: "db_error" }, { status: 500 });
  }
}



