'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/** 고정 관리자 ID */
const ADMIN_ID_FIXED = 'medela1280';

/** SHA-256 해시 */
async function sha256(text: string) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function LoginPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(false);

  /** 첫 로드: 저장된 ID 채우기 + 자동 로그인 */
  useEffect(() => {
    try {
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
    } catch {
      // localStorage 접근 실패시 무시
    }
  }, [router]);

  /** 로그인 처리 (관리자 정보 검증 포함) */
  const handleLogin = async () => {
    if (!userId || !password) {
      alert('아이디와 비밀번호를 입력하세요.');
      return;
    }

    // 1) 관리자 ID 검증 (고정)
    if (userId !== ADMIN_ID_FIXED) {
      alert('관리자 ID가 아닙니다.');
      return;
    }

    // 2) 비밀번호 검증(설정되어 있을 때만)
    const savedSalt = localStorage.getItem('admin_pw_salt');
    const savedHash = localStorage.getItem('admin_pw_hash');

    if (savedSalt && savedHash) {
      const tryHash = await sha256(`${savedSalt}|${password}`);
      if (tryHash !== savedHash) {
        alert('비밀번호가 올바르지 않습니다.');
        return;
      }
    }
    // *처음에는 관리자 비밀번호가 없을 수 있음 → 그 경우 통과
    //   이후 "관리자 설정"에서 비밀번호 저장하면 다음 로그인부터 검증됨.

    // 3) 아이디 저장
    if (rememberId) localStorage.setItem('erp_user', userId);
    else localStorage.removeItem('erp_user');

    // 4) 세션 플래그(30일 유효)
    const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
    localStorage.setItem('erp_auth', '1');
    localStorage.setItem('erp_auth_exp', String(exp));

    router.replace('/');
  };

  return (
    // 배경과 카드 색 동일
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-sm rounded-lg p-6 bg-gray-100">
        {/* 로고 + 제목: 로고 50% 확대, 제목 50% 확대, 연한 회색, 좌측 정렬 */}
        <div className="flex items-center gap-3 mb-4">
          <Image
            src="/moyulogo.jpg"  // public/moyulogo.jpg
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




