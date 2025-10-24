'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ApiResp =
  | { ok: true; role: 'admin' | 'user'; username: string }
  | { ok: false; error?: string; message?: string };

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);
  const [busy, setBusy] = useState(false);

  // ✅ 아이디 저장 불러오기
  useEffect(() => {
    const savedId = localStorage.getItem('erp_user');
    if (savedId) {
      setUserId(savedId);
      setRememberId(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!userId || !password) {
      alert('아이디와 비밀번호를 입력하세요.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userId, password }),
      });
      const data: ApiResp = await res.json();

      if (data.ok) {
        if (rememberId) localStorage.setItem('erp_user', userId);
        else localStorage.removeItem('erp_user');
        router.replace('/');
      } else {
        alert(data.message || '로그인 실패');
      }
    } catch (err) {
      alert('서버와 통신할 수 없습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-10 rounded-2xl shadow-lg w-[380px] text-center">
        <div className="flex justify-center mb-4">
          <Image src="/logo.png" alt="Moulab Logo" width={64} height={64} priority />
        </div>
        <h1 className="text-2xl font-bold text-gray-700 mb-8">moulab ERP</h1>

        <input
          type="text"
          placeholder="아이디"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="w-full border rounded-md p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={handleKey}
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded-md p-3 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={handleKey}
        />

        <div className="flex items-center mb-4 text-sm text-gray-600">
          <input
            id="remember"
            type="checkbox"
            checked={rememberId}
            onChange={(e) => setRememberId(e.target.checked)}
            className="mr-2"
          />
          <label htmlFor="remember">아이디 저장</label>
        </div>

        <button
          onClick={handleLogin}
          disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-md transition"
        >
          {busy ? '로그인 중...' : '로그인'}
        </button>
      </div>
    </div>
  );
}

