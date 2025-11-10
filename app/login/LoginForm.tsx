'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ApiResp =
  | { ok: true; role: 'admin' | 'user'; username: string }
  | { ok: false; error?: string; message?: string };

export default function LoginForm() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);
  const [busy, setBusy] = useState(false);

  // ✅ 저장된 ID 불러오기 (선택적으로만 유지)
  useEffect(() => {
    try {
      const savedId = sessionStorage.getItem('remember_user');
      if (savedId) {
        setUserId(savedId);
        setRememberId(true);
      }
    } catch {}
  }, []);

  const handleLogin = async () => {
    if (!userId || !password) {
      alert('아이디와 비밀번호를 입력하세요.');
      return;
    }

    setBusy(true);
    try {
      const resp = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ✅ 세션 쿠키 기반 인증
        body: JSON.stringify({ username: userId.trim(), password }),
      });

      const data: ApiResp = await resp.json();

      if (!data.ok) {
        alert(data.message || data.error || '로그인 실패');
        return;
      }

      // ✅ 아이디 저장만 sessionStorage로 유지 (선택적)
      if (rememberId) sessionStorage.setItem('remember_user', userId.trim());
      else sessionStorage.removeItem('remember_user');

      // ✅ 클라우드 기반: localStorage 전혀 사용하지 않음
      router.replace('/');
    } catch {
      alert('서버와 통신할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm bg-white p-8 rounded-lg shadow-md border border-gray-200">
      <div className="flex flex-col items-center mb-6">
        <Image
          src="/moyulogo.jpg"
          alt="moulab logo"
          width={65}
          height={65}
          priority
          className="rounded-sm mb-3"
        />
        <h1 className="text-3xl font-bold text-gray-500">moulab ERP</h1>
      </div>

      <div className="space-y-3">
        <input
          className="w-full border rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          type="text"
          placeholder="아이디"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
        />
        <input
          className="w-full border rounded px-3 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
        />
      </div>

      <div className="flex items-center mt-4 mb-6 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mr-2 accent-blue-500"
          checked={rememberId}
          onChange={(e) => setRememberId(e.target.checked)}
        />
        아이디 저장
      </div>

      <button
        onClick={handleLogin}
        disabled={busy}
        className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 transition disabled:opacity-60"
      >
        {busy ? '로그인 중…' : '로그인'}
      </button>
    </div>
  );
}

