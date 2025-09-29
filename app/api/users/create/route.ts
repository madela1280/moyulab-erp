// app/api/users/create/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

type ReqBody = { username: string; password: string; name?: string; phone?: string; role?: 'user'|'admin' };

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

    if (users.some(u => u.username === body.username)) {
      return NextResponse.json({ ok:false, error:'exists' }, { status:409 });
    }

    const salt = crypto.randomBytes(8).toString('hex');
    const pwHash = sha256(`${salt}|${body.password}`);

    users.push({
      username: body.username,
      name: body.name ?? '',
      phone: body.phone ?? '',
      role: body.role ?? 'user',
      pwSalt: salt,
      pwHash,
      createdAt: Date.now(),
    });

    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
    return NextResponse.json({ ok:true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, error:'server' }, { status:500 });
  }
}
