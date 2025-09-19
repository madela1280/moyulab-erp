'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ADMIN_ID_FIXED = 'medela1280';

async function sha256(text: string) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

type UserRow = { id: string; name: string; phone: string; username: string; pwHash: string; pwSalt: string; createdAt: number };

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem('erp_user');
      if (savedId) { setUserId(savedId); setRememberId(true); }
      // 탭/창 나가면 자동 로그아웃 (session 기반)
      const onHide = () => { sessionStorage.removeItem('erp_auth'); sessionStorage.removeItem('erp_user'); sessionStorage.removeItem('erp_role'); };
      window.addEventListener('pagehide', onHide);
      window.addEventListener('beforeunload', onHide);
      return () => {
        window.removeEventListener('pagehide', onHide);
        window.removeEventListener('beforeunload', onHide);
      };
    } catch {}
  }, []);

  const handleLogin = async () => {
    if (!userId || !password) { alert('아이디와 비밀번호를 입력하세요.'); return; }

    // 1) 일반 사용자 목록에서 찾기 (로컬 저장된 사용자)
    try {
      const raw = localStorage.getItem('erp_users');
      const list: UserRow[] = raw ? JSON.parse(raw) : [];

      const found = list.find(u => u.username === userId.trim());
      if (found) {
        const tryHash = await sha256(`${found.pwSalt}|${password}`);
        if (tryHash !== found.pwHash) { alert('아이디 또는 비밀번호가 올바르지 않습니다.'); return; }

        // 로그인 성공 (일반 사용자)
        if (rememberId) localStorage.setItem('erp_user', userId.trim());
        else localStorage.removeItem('erp_user');

        sessionStorage.setItem('erp_auth', '1');
        sessionStorage.setItem('erp_user', userId.trim());
        sessionStorage.setItem('erp_role', 'user');
        router.replace('/');
        return;
      }
    } catch {
      // 무시하고 관리자 체크로 진행
    }

    // 2) 관리자(고정 ID) 체크
    if (userId.trim() === ADMIN_ID_FIXED) {
      const savedSalt = localStorage.getItem('admin_pw_salt');
      const savedHash = localStorage.getItem('admin_pw_hash');

      if (!savedSalt || !savedHash) {
        alert('관리자 비밀번호가 설정되지 않았습니다. 관리자 설정에서 먼저 비밀번호를 설정하세요.');
        return;
      }
      const tryHash = await sha256(`${savedSalt}|${password}`);
      if (tryHash !== savedHash) { alert('아이디 또는 비밀번호가 올바르지 않습니다.'); return; }

      // 로그인 성공 (관리자)
      if (rememberId) localStorage.setItem('erp_user', userId.trim());
      else localStorage.removeItem('erp_user');

      sessionStorage.setItem('erp_auth', '1');
      sessionStorage.setItem('erp_user', userId.trim());
      sessionStorage.setItem('erp_role', 'admin');
      router.replace('/');
      return;
    }

    // 3) 어디에도 없으면 실패
    alert('아이디 또는 비밀번호가 올바르지 않습니다.');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-lg p-6 bg-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <Image src="/moyulogo.jpg" alt="moulab logo" width={63} height={63} priority className="rounded-sm" />
          <h1 className="text-[2.16rem] leading-tight font-bold text-gray-400">moulab ERP</h1>
        </div>

        <div className="mb-3">
          <input className="w-full border rounded px-3 py-2 bg-white" type="text" placeholder="아이디"
                 value={userId} onChange={(e)=>setUserId(e.target.value)} />
        </div>
        <div className="mb-3">
          <input className="w-full border rounded px-3 py-2 bg-white" type="password" placeholder="비밀번호"
                 value={password} onChange={(e)=>setPassword(e.target.value)} />
        </div>

        <label className="flex items-center text-sm mb-4 select-none">
          <input type="checkbox" className="mr-2" checked={rememberId} onChange={(e)=>setRememberId(e.target.checked)} />
          아이디 저장
        </label>

        <button onClick={handleLogin} className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700">
          로그인
        </button>
      </div>
    </div>
  );
}



