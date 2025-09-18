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

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);

  useEffect(() => {
    try {
      const savedId = localStorage.getItem('erp_user');
      if (savedId) { setUserId(savedId); setRememberId(true); }
      // 🚫 자동 로그인 없음 (sessionStorage 기반)
      // 나갈 때 자동 로그아웃
      const onHide = () => { sessionStorage.removeItem('erp_auth'); };
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
    if (userId !== ADMIN_ID_FIXED) { alert('관리자 ID가 아닙니다.'); return; }

    const savedSalt = localStorage.getItem('admin_pw_salt');
    const savedHash = localStorage.getItem('admin_pw_hash');
    if (savedSalt && savedHash) {
      const tryHash = await sha256(`${savedSalt}|${password}`);
      if (tryHash !== savedHash) { alert('비밀번호가 올바르지 않습니다.'); return; }
    }

    if (rememberId) localStorage.setItem('erp_user', userId);
    else localStorage.removeItem('erp_user');

    // ✅ 세션 인증: 탭/창 닫거나 이동하면 사라짐
    sessionStorage.setItem('erp_auth', '1');

    router.replace('/');
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




