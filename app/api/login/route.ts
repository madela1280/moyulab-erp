import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/app/lib/db';

type ReqBody = { username: string; password: string };

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });
    }

    // 1) DB에서 사용자/관리자 모두 조회
    const result = await query(
      'SELECT username, password_hash, salt, role, COALESCE(phone, \'\') AS phone, COALESCE(name, \'\') AS name FROM users WHERE username=$1',
      [body.username]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'invalid_user' }, { status: 403 });
    }

    const u = result.rows[0];
    const tryHash = sha256(`${u.salt}|${body.password}`);
    if (tryHash !== u.password_hash) {
      return NextResponse.json({ ok: false, error: 'invalid_password' }, { status: 403 });
    }

    // 로그인 성공
    return NextResponse.json({
      ok: true,
      role: u.role ?? 'user',
      username: u.username,
      name: u.name,
      phone: u.phone,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}

