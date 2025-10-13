// app/api/login/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { query } from '@/app/lib/db';

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

/**
 * DB 로그인:
 * - 우선 1) password_hash + salt 검증 (신규 방식)
 * - 우선 2) password(레거시 평문) 검증 (기존 사용자 호환)
 * - 어떤 쪽도 맞지 않으면 {ok:false}
 */
async function tryDbLogin(username: string, rawPassword: string) {
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
  if (r.rows.length === 0) return { ok: false, code: 'invalid_user' as const };

  const u = r.rows[0] as {
    username: string;
    legacy_password: string | null;
    password_hash: string | null;
    salt: string | null;
    role: string;
    name: string;
    phone: string;
  };

  // 1) 해시+솔트 우선
  if (u.password_hash && u.salt) {
    const tryHash = sha256(`${u.salt}|${rawPassword}`);
    if (tryHash === u.password_hash) {
      return { ok: true as const, role: u.role, username: u.username, name: u.name, phone: u.phone };
    }
    // 해시 불일치면 DB 실패로 간주(아래에서 다른 경로로 계속 시도)
  } else if (u.legacy_password != null) {
    // 2) 레거시 평문
    if (u.legacy_password === rawPassword) {
      return { ok: true as const, role: u.role, username: u.username, name: u.name, phone: u.phone };
    }
  }

  return { ok: false as const, code: 'invalid_password' as const };
}

function tryEnvAdminLogin(username: string, password: string) {
  const ADMIN_ID = process.env.ADMIN_ID || 'medela1280';
  const ADMIN_SALT = process.env.ADMIN_SALT;
  const ADMIN_HASH = process.env.ADMIN_HASH;

  if (!ADMIN_SALT || !ADMIN_HASH) return null;

  if (username !== ADMIN_ID) return { ok: false, code: 'invalid_user' as const };
  const tryHash = sha256(`${ADMIN_SALT}|${password}`);
  if (tryHash !== ADMIN_HASH) return { ok: false, code: 'invalid_password' as const };

  return { ok: true as const, role: 'admin', username: ADMIN_ID, name: '', phone: '' };
}

function tryFileLogin(root: string, username: string, password: string) {
  const usersPath = path.resolve(root, 'users.json');
  const users: Array<{
    username: string;
    name?: string;
    phone?: string;
    pwHash: string;
    pwSalt: string;
    role?: string;
  }> = readJSON(usersPath, []);

  const u = users.find((x) => x.username === username);
  if (u) {
    const tryHash = sha256(`${u.pwSalt}|${password}`);
    if (tryHash !== u.pwHash) return { ok: false, code: 'invalid_password' as const };
    return { ok: true as const, role: u.role ?? 'user', username: u.username, name: u.name ?? '', phone: u.phone ?? '' };
  }

  const adminPath = path.resolve(root, 'admin.json');
  const admin = readJSON(adminPath, null);
  if (!admin) return { ok: false, code: 'invalid_user' as const };

  const adminUser = admin.username ?? 'admin';
  if (username !== adminUser) return { ok: false, code: 'invalid_user' as const };
  const tryHash = sha256(`${admin.pwSalt}|${password}`);
  if (tryHash !== admin.pwHash) return { ok: false, code: 'invalid_password' as const };

  return { ok: true as const, role: 'admin', username: adminUser, name: '', phone: '' };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok: false, error: 'missing' }, { status: 400 });
    }

    // 1) DB 시도 (성공 시 즉시 반환, 실패여도 "중단하지 않고" 다음 경로 시도)
    try {
      const dbRes = await tryDbLogin(body.username, body.password);
      if (dbRes.ok) {
        return NextResponse.json({
          ok: true,
          role: dbRes.role,
          username: dbRes.username,
          name: dbRes.name,
          phone: dbRes.phone,
        });
      }
      // 여기서 바로 403 내리지 않고, 아래 ENV/파일 경로 계속 시도 (중요)
    } catch (err) {
      // DB 자체 연결 실패 시에도 아래 경로 계속 시도
      console.error('DB login error:', err);
    }

    // 2) ENV 관리자
    const envRes = tryEnvAdminLogin(body.username, body.password);
    if (envRes?.ok) {
      return NextResponse.json({
        ok: true,
        role: envRes.role,
        username: envRes.username,
        name: envRes.name,
        phone: envRes.phone,
      });
    }

    // 3) 파일(users.json/admin.json)
    const fileRes = tryFileLogin(process.cwd(), body.username, body.password);
    if (fileRes.ok) {
      return NextResponse.json({
        ok: true,
        role: fileRes.role,
        username: fileRes.username,
        name: fileRes.name,
        phone: fileRes.phone,
      });
    }

    // 모두 실패
    return NextResponse.json({ ok: false, error: fileRes.code ?? envRes?.code ?? 'invalid' }, { status: 403 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }
}






