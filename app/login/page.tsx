'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);

  // ⬇️ 페이지 로드 시 localStorage 값 불러오기
  useEffect(() => {
    const savedId = localStorage.getItem('erp_user');
    const auto = localStorage.getItem('erp_auth');
    const exp = localStorage.getItem('erp_auth_exp');

    // 아이디 저장한 경우 미리 채워 넣기
    if (savedId) {
      setUserId(savedId);
      setRememberId(true);
    }

    // 세션 플래그 + 만료 확인 → 자동 로그인
    if (auto === '1' && exp && new Date().getTime() < parseInt(exp)) {
      router.replace('/');
    }
  }, [router]);

  const handleLogin = () => {
    if (!userId || !password) {
      alert('아이디와 비밀번호를 입력하세요.');
      return;
    }

    // 실제 검증 로직은 추후 DB/서버 연결 시 교체
    // 지금은 입력만 있으면 로그인 성공 처리
    if (rememberId) {
      localStorage.setItem('erp_user', userId);
    } else {
      localStorage.removeItem('erp_user');
    }

    // 세션 플래그 저장 (30일 유효)
    const exp = new Date().getTime() + 1000 * 60 * 60 * 24 * 30;
    localStorage.setItem('erp_auth', '1');
    localStorage.setItem('erp_auth_exp', exp.toString());

    router.replace('/');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm bg-white shadow-md rounded-lg p-6">
        <h1 className="text-xl font-bold text-center mb-4">Moyulab ERP 로그인</h1>

        <div className="mb-3">
          <input
            type="text"
            placeholder="아이디"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center text-sm">
            <input
              type="checkbox"
              checked={rememberId}
              onChange={(e) => setRememberId(e.target.checked)}
              className="mr-2"
            />
            아이디 저장
          </label>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
        >
          로그인
        </button>
      </div>
    </div>
  );
}
