// app/api/login/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/app/lib/db';

type ReqBody = { username: string; password: string };
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

/**
 * DB 전용 로그인:
 * 1) password_hash + salt 우선
 * 2) 없으면 legacy password(평문) 허용
 */
async function dbLogin(username: string, rawPassword: string) {
  const sql = `
    SELECT
      username,
      password       AS legacy_password,
      password_hash,
      salt,
      COALESCE(role,'user')   AS role,
      COALESCE(name,'')       AS name,
      COALESCE(phone,'')      AS phone
    FROM users
    WHERE username = $1
    LIMIT 1
  `;
  const r = await query(sql, [username]);
  if (r.rows.length === 0) return { ok: false as const, code: 'invalid_user' as const };
  const u = r.rows[0] as {
    username: string;
    legacy_password: string | null;
    password_hash: string | null;
    salt: string | null;
    role: string;
    name: string;
    phone: string;
  };

  if (u.password_hash && u.salt) {
    const tryHash = sha256(`${u.salt}|${rawPassword}`);
    if (tryHash === u.password_hash) {
      return { ok: true as const, role: u.role, username: u.username, name: u.name, phone: u.phone };
    }
    return { ok: false as const, code: 'invalid_password' as const };
  }

  if (u.legacy_password != null) {
    if (u.legacy_password === rawPassword) {
      return { ok: true as const, role: u.role, username: u.username, name: u.name, phone: u.phone };
    }
    return { ok: false as const, code: 'invalid_password' as const };
  }

  return { ok: false as const, code: 'invalid_password' as const };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });
    }

    const res = await dbLogin(body.username, body.password);
    if (res.ok) {
      return NextResponse.json({
        ok: true,
        role: res.role,
        username: res.username,
        name: res.name,
        phone: res.phone,
      });
    }
    return NextResponse.json({ ok: false, error: res.code }, { status: 403 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}








