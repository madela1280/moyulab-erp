// app/api/admin/set-password/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ADMIN_STORE = path.join(process.cwd(), 'admin.json');

function sha256(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function POST(req: Request) {
  try {
    const { username, password, role } = await req.json();
    if (!username || !password) return NextResponse.json({ ok: false, message: 'missing' }, { status: 400 });

    const salt = crypto.randomBytes(8).toString('hex');
    const hash = sha256(`${salt}|${password}`);

    let store: any = {};
    try { store = JSON.parse(fs.readFileSync(ADMIN_STORE, 'utf-8') || '{}'); } catch {}
    store.serverSecret = store.serverSecret || crypto.randomBytes(16).toString('hex');
    store.users = store.users || [];

    const existing = store.users.find((u:any)=>u.username===username);
    if (existing) {
      existing.pwSalt = salt;
      existing.pwHash = hash;
      existing.role = role || existing.role;
    } else {
      store.users.push({ username, pwSalt: salt, pwHash: hash, role: role || 'admin' });
    }
    fs.writeFileSync(ADMIN_STORE, JSON.stringify(store, null, 2), 'utf-8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
