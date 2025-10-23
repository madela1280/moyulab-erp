import { Pool } from "pg";

const pool = new Pool({
  host: "121.78.183.227",
  user: "postgres",
  password: "StrongPassword123!",
  database: "erp",
  port: 5432,
  ssl: { rejectUnauthorized: false },
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

