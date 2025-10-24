import { Pool } from "pg";

const pool = new Pool({
  host: process.env.DB_HOST || "121.78.183.227",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "StrongPassword123!",
  database: process.env.DB_NAME || "erp",
  port: Number(process.env.DB_PORT) || 5432,
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


