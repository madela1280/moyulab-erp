// app/api/login/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/app/lib/db';

type ReqBody = { username: string; password: string };

// 기존 규칙 유지: SHA-256( salt + '|' + password )
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

async function dbLogin(username: string, rawPassword: string) {
  const sql = `
    SELECT
      username,
      password_hash,
      salt,
      COALESCE(role, 'user') AS role,
      COALESCE(name, '')     AS name,
      COALESCE(phone, '')    AS phone
    FROM users
    WHERE username = $1
    LIMIT 1
  `;
  const r = await query(sql, [username]);

  if (r.rows.length === 0) {
    return { ok: false as const, code: 'invalid_user' as const };
  }

  const u = r.rows[0] as {
    username: string;
    password_hash: string | null;
    salt: string | null;
    role: string;
    name: string;
    phone: string;
  };

  if (!u.password_hash || !u.salt) {
    return { ok: false as const, code: 'invalid_password' as const };
  }

  const tryHash = sha256(`${u.salt}|${rawPassword}`);
  if (tryHash !== u.password_hash) {
    return { ok: false as const, code: 'invalid_password' as const };
  }

  return { ok: true as const, ...u };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });
    }

    // 오직 DB만 사용 (파일 폴백 제거)
    const res = await dbLogin(body.username, body.password);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: 'invalid' }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      role: res.role,
      username: res.username,
      name: res.name,
      phone: res.phone,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}










