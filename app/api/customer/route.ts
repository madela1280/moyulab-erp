import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

// 숫자만 남기기 (010-1234-5678 -> 01012345678)
const onlyDigits = (s: string) => s.replace(/\D/g, "");

type Customer = {
  phone: string;
  name: string;
  startDate: string;
  endDate: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json({ error: "전화번호가 필요합니다." }, { status: 400 });
  }

  const input = onlyDigits(phone);

  // public/data/customers.json 읽기
  const filePath = path.join(process.cwd(), "public", "data", "customers.json");
  let raw = "[]";
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    return NextResponse.json({ error: "데이터 파일을 찾을 수 없습니다." }, { status: 500 });
  }

  let list: Customer[] = [];
  try {
    list = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "데이터 파싱 오류" }, { status: 500 });
  }

  // 전화번호 숫자만 비교 (정확 일치)
  const found = list.find((c) => onlyDigits(c.phone) === input);

  if (!found) {
    return NextResponse.json({ error: "고객 정보를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(found);
}

