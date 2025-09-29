import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  // 빌드 단계에서는 바로 throw 하지 않고, 런타임에서만 에러 발생시킴
  console.warn("⚠️ DATABASE_URL is not set. DB 연결은 런타임에서 실패할 수 있습니다.");
}

const pool = new Pool({
  connectionString: url,
});

export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

