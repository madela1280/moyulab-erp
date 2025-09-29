// app/api/users/set-password/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type ReqBody = { username: string; current?: string; password: string };

function sha256(s: string) { return crypto.createHash('sha256').update(s).digest('hex'); }
function readJSON(p: string, fallback: any) {
  try { if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p,'utf8') || 'null') ?? fallback; } catch {}
  return fallback;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    if (!body?.username || !body?.password) {
      return NextResponse.json({ ok:false, error:'missing' }, { status:400 });
    }

    const root = process.cwd();
    const usersPath = path.resolve(root, 'users.json');
    const users: any[] = readJSON(usersPath, []);

    const u = users.find(x => x.username === body.username);
    if (!u) return NextResponse.json({ ok:false, error:'not_found' }, { status:404 });

    // 현재 비번 검증(이미 비번이 있다면)
    if (u.pwHash) {
      if (!body.current) return NextResponse.json({ ok:false, error:'need_current' }, { status:403 });
      const check = sha256(`${u.pwSalt}|${body.current}`);
      if (check !== u.pwHash) return NextResponse.json({ ok:false, error:'wrong_current' }, { status:403 });
    }

    const salt = crypto.randomBytes(8).toString('hex');
    const pwHash = sha256(`${salt}|${body.password}`);
    u.pwSalt = salt;
    u.pwHash = pwHash;

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    return NextResponse.json({ ok:true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, error:'server' }, { status:500 });
  }
}
