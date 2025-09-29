// app/api/login/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type ReqBody = { username: string; password: string };

function sha256(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function readJSON(p: string, fallback: any) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8') || 'null') ?? fallback;
  } catch {}
  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });
    }

    const root = process.cwd();

    // 1) 일반 사용자(users.json)에서 먼저 찾기
    const usersPath = path.resolve(root, 'users.json');
    const users: Array<{ username: string; name?: string; phone?: string; pwHash: string; pwSalt: string; role?: string }> =
      readJSON(usersPath, []);

    const u = users.find(x => x.username === body.username);
    if (u) {
      const tryHash = sha256(`${u.pwSalt}|${body.password}`);
      if (tryHash !== u.pwHash) return NextResponse.json({ ok: false, error: 'invalid_password' }, { status: 403 });
      return NextResponse.json({ ok: true, role: u.role ?? 'user', username: u.username, name: u.name ?? '' });
    }

    // 2) 관리자(admin.json) 확인
    const adminPath = path.resolve(root, 'admin.json');
    const adminRaw = readJSON(adminPath, null);
    if (!adminRaw) return NextResponse.json({ ok: false, error: 'no_admin' }, { status: 500 });

    const adminUser = adminRaw.username ?? 'admin';
    if (body.username !== adminUser) {
      return NextResponse.json({ ok: false, error: 'invalid_user' }, { status: 403 });
    }

    const tryHash = sha256(`${adminRaw.pwSalt}|${body.password}`);
    if (tryHash !== adminRaw.pwHash) return NextResponse.json({ ok: false, error: 'invalid_password' }, { status: 403 });

    return NextResponse.json({ ok: true, role: 'admin', username: adminUser });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}
