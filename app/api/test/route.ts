// app/api/test/route.ts
import { NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const result = await query("SELECT * FROM customers LIMIT 5");
    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: "DB connection failed" }, { status: 500 });
  }
}
