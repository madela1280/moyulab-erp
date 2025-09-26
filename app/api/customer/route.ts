import { NextRequest, NextResponse } from "next/server";

// GET /api/customer?phone=01012345678
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");

  if (!phone) {
    return NextResponse.json(
      { error: "전화번호가 필요합니다." },
      { status: 400 }
    );
  }

  // 🔹 지금은 테스트용 더미 데이터
  const dummy = {
    phone: "01012345678",
    name: "홍길동",
    startDate: "2025-09-01",
    endDate: "2025-10-01",
  };

  if (phone === dummy.phone) {
    return NextResponse.json(dummy);
  } else {
    return NextResponse.json({ error: "고객 정보를 찾을 수 없습니다." }, { status: 404 });
  }
}
