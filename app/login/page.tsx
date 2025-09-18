'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);

  // 초기 로드: 저장된 값/자동 로그인
  useEffect(() => {
    const savedId = localStorage.getItem('erp_user');
    const auto = localStorage.getItem('erp_auth');
    const exp = localStorage.getItem('erp_auth_exp');

    if (savedId) {
      setUserId(savedId);
      setRememberId(true);
    }
    if (auto === '1' && exp && Date.now() < Number(exp)) {
      router.replace('/');
    }
  }, [router]);

  const handleLogin = () => {
    if (!userId || !password) {
      alert('아이디와 비밀번호를 입력하세요.');
      return;
    }
    if (rememberId) localStorage.setItem('erp_user', userId);
    else localStorage.removeItem('erp_user');

    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
    localStorage.setItem('erp_auth', '1');
    localStorage.setItem('erp_auth_exp', String(exp));

    router.replace('/');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-lg p-6 bg-gray-100">
        {/* 로고 50% 확대, 제목 50% 확대, 연한 회색, 좌측 정렬 */}
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/moyulogo.jpg"
            alt="moulab logo"
            width={63}
            height={63}
            priority
            className="rounded-sm"
          />
          <h1 className="text-[2.16rem] leading-tight font-bold text-gray-400">
            moulab ERP
          </h1>
        </div>

        {/* 입력 박스 */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="아이디"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-white"
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-white"
          />
        </div>

        <label className="flex items-center text-sm mb-4 select-none">
          <input
            type="checkbox"
            checked={rememberId}
            onChange={(e) => setRememberId(e.target.checked)}
            className="mr-2"
          />
          아이디 저장
        </label>

        <button
          onClick={handleLogin}
          className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          로그인
        </button>
      </div>
    </div>
  );
}



