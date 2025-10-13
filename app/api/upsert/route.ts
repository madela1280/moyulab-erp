// app/api/users/upsert/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/app/lib/db';

type Body = {
  username: string;
  password?: string;   // 새 비번(옵션). 주면 hash+salt 갱신
  role?: 'admin'|'user';
  name?: string;
  phone?: string;
};
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

export async function POST(req: Request) {
  try {
    const b = (await req.json()) as Body;
    if (!b?.username) return NextResponse.json({ ok:false, error:'missing_username' }, { status:400 });

    let setCols: string[] = [];
    let params: any[] = [];
    let i = 1;

    if (b.name !== undefined) { setCols.push(`name = $${i++}`); params.push(b.name); }
    if (b.phone !== undefined){ setCols.push(`phone = $${i++}`); params.push(b.phone); }
    if (b.role !== undefined) { setCols.push(`role = $${i++}`); params.push(b.role); }

    if (b.password && b.password.length > 0) {
      const salt = crypto.randomBytes(8).toString('hex');
      const password_hash = sha256(`${salt}|${b.password}`);
      setCols.push(`salt = $${i++}`);           params.push(salt);
      setCols.push(`password_hash = $${i++}`);  params.push(password_hash);
      // 레거시 password null 처리(선택): setCols.push(`password = NULL`);
    }

    if (setCols.length === 0) {
      // 아무 것도 변경할 값이 없으면 통과
      return NextResponse.json({ ok:true, updated:false });
    }

    params.push(b.username);
    const sql = `
      INSERT INTO users (username${b.password?`, salt, password_hash`:''}${b.role?`, role`:''}${b.name?`, name`:''}${b.phone?`, phone`:''})
      VALUES ($${params.length}${b.password?`, $${params.length-3}, $${params.length-2}`:''}${b.role?`, $${params.length-1-(b.name?1:0)-(b.phone?1:0)}`:''}${b.name?`, $${params.length-1-(b.phone?1:0)}`:''}${b.phone?`, $${params.length}`:''})
      ON CONFLICT (username) DO UPDATE
      SET ${setCols.join(', ')}
    `;
    // 위 INSERT value 인덱싱이 복잡해 보이면, 간단히 UPDATE만 쓰고, 없으면 만들어주는 2단계로 나눠도 됨.
    // 안정적으로 하려면 아래처럼 두 단계로:
    try {
      await query(`INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`, [b.username]);
      await query(`UPDATE users SET ${setCols.join(', ')} WHERE username = $${i}`, params);
    } catch (e) {
      console.error(e);
      return NextResponse.json({ ok:false, error:'db' }, { status:500 });
    }

    return NextResponse.json({ ok:true, updated:true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok:false, error:'server' }, { status:500 });
  }
}
