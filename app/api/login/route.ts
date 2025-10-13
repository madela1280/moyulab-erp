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

async function tryDbLogin(username: string, password: string) {
  // DATABASE_URL 없거나 DB 죽어있으면 여기서 에러 던져짐 → 호출측에서 fallback
  const sql =
    "SELECT username, password_hash, salt, role, COALESCE(name,'') AS name, COALESCE(phone,'') AS phone FROM users WHERE username=$1";
  const r = await query(sql, [username]);
  if (r.rows.length === 0) return { ok: false, code: 'invalid_user' };

  const u = r.rows[0];
  const tryHash = sha256(`${u.salt}|${password}`);
  if (tryHash !== u.password_hash) return { ok: false, code: 'invalid_password' };

  return {
    ok: true as const,
    role: (u.role as string) || 'user',
    username: u.username as string,
    name: u.name as string,
    phone: u.phone as string,
  };
}

function tryEnvAdminLogin(username: string, password: string) {
  const ADMIN_ID = process.env.ADMIN_ID || 'medela1280';
  const ADMIN_SALT = process.env.ADMIN_SALT;
  const ADMIN_HASH = process.env.ADMIN_HASH;

  if (!ADMIN_SALT || !ADMIN_HASH) return null; // ENV 미설정 → 다음 fallback으로

  if (username !== ADMIN_ID) return { ok: false, code: 'invalid_user' as const };
  const tryHash = sha256(`${ADMIN_SALT}|${password}`);
  if (tryHash !== ADMIN_HASH) return { ok: false, code: 'invalid_password' as const };

  return { ok: true as const, role: 'admin', username: ADMIN_ID, name: '', phone: '' };
}

function tryFileLogin(root: string, username: string, password: string) {
  // users.json 우선
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

  // 2) 관리자 계정 확인 (환경변수 → DB 우선)
const envAdminId = process.env.ADMIN_ID;
const envSalt = process.env.ADMIN_SALT;
const envHash = process.env.ADMIN_HASH;

if (envAdminId && envSalt && envHash) {
  if (body.username === envAdminId) {
    const tryHash = sha256(`${envSalt}|${body.password}`);
    if (tryHash !== envHash) {
      return NextResponse.json({ ok: false, error: 'invalid_password' }, { status: 403 });
    }
    return NextResponse.json({ ok: true, role: 'admin', username: envAdminId });
  }
}

    // 1) 먼저 DB 시도
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
      // DB 연결은 됐는데 사용자/비번 불일치면 그대로 에러 리턴
      return NextResponse.json({ ok: false, error: dbRes.code }, { status: 403 });
    } catch {
      // 2) DB 미설정/죽음 → ENV 관리자 fallback
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
      // 3) 파일(users.json/admin.json) fallback
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
      return NextResponse.json({ ok: false, error: fileRes.code }, { status: 403 });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: 'server' }, { status: 500 });
  }



