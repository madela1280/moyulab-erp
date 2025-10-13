// app/api/login/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '@/app/lib/db';

type ReqBody = { username: string; password: string };
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

function readJSON(p: string, fallback: any) {
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8') || 'null') ?? fallback;
  } catch {}
  return fallback;
}

async function dbLogin(username: string, rawPassword: string) {
  const sql = `
    SELECT username,
           password       AS legacy_password,
           password_hash,
           salt,
           COALESCE(role,'user')  AS role,
           COALESCE(name,'')      AS name,
           COALESCE(phone,'')     AS phone
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
    if (tryHash === u.password_hash) return { ok: true as const, ...u };
    return { ok: false as const, code: 'invalid_password' as const };
  }

  if (u.legacy_password != null) {
    if (u.legacy_password === rawPassword) return { ok: true as const, ...u };
    return { ok: false as const, code: 'invalid_password' as const };
  }

  return { ok: false as const, code: 'invalid_password' as const };
}

/** 파일(users.json/admin.json) 확인 + 성공 시 DB에 즉시 동기화(업서트) */
async function fileLoginAndSync(root: string, username: string, rawPassword: string) {
  // users.json
  const usersPath = path.resolve(root, 'users.json');
  const users: Array<{ username: string; name?: string; phone?: string; pwHash: string; pwSalt: string; role?: string; }>
    = readJSON(usersPath, []);
  const u = users.find((x) => x.username === username);
  if (u) {
    const tryHash = sha256(`${u.pwSalt}|${rawPassword}`);
    if (tryHash !== u.pwHash) return { ok: false as const, code: 'invalid_password' as const };

    // DB 업서트 동기화
    await query(
      `INSERT INTO users (username, role, name, phone, password_hash, salt)
       VALUES ($1, COALESCE($2,'user'), COALESCE($3,''), COALESCE($4,''), $5, $6)
       ON CONFLICT (username)
       DO UPDATE SET
         role = EXCLUDED.role,
         name = EXCLUDED.name,
         phone = EXCLUDED.phone,
         password_hash = EXCLUDED.password_hash,
         salt = EXCLUDED.salt`,
      [u.username, u.role ?? 'user', u.name ?? '', u.phone ?? '', u.pwHash, u.pwSalt]
    );

    return { ok: true as const, role: u.role ?? 'user', username: u.username, name: u.name ?? '', phone: u.phone ?? '' };
  }

  // admin.json
  const adminPath = path.resolve(root, 'admin.json');
  const admin = readJSON(adminPath, null);
  if (admin) {
    const adminUser = (admin.username ?? 'admin') as string;
    if (username !== adminUser) return { ok: false as const, code: 'invalid_user' as const };
    const tryHash = sha256(`${admin.pwSalt}|${rawPassword}`);
    if (tryHash !== admin.pwHash) return { ok: false as const, code: 'invalid_password' as const };

    // DB 업서트 동기화
    await query(
      `INSERT INTO users (username, role, name, phone, password_hash, salt)
       VALUES ($1, 'admin', '', '', $2, $3)
       ON CONFLICT (username)
       DO UPDATE SET
         role='admin',
         password_hash = EXCLUDED.password_hash,
         salt = EXCLUDED.salt`,
      [adminUser, admin.pwHash as string, admin.pwSalt as string]
    );

    return { ok: true as const, role: 'admin', username: adminUser, name: '', phone: '' };
  }

  return { ok: false as const, code: 'invalid_user' as const };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });
    }

    // 1) DB 시도
    try {
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
    } catch (e) {
      // DB 장애시 파일 경로로 폴백
    }

    // 2) 파일 시도 + 성공 시 DB에 즉시 동기화
    try {
      const fres = await fileLoginAndSync(process.cwd(), body.username, body.password);
      if (fres.ok) {
        return NextResponse.json({
          ok: true,
          role: fres.role,
          username: fres.username,
          name: fres.name,
          phone: fres.phone,
        });
      }
    } catch (e) {
      // 파일도 실패 시 아래 403
    }

    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 403 });
  } catch {
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}









