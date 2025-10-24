'use client';

import React, { useEffect, useState } from 'react';
import UnifiedGrid from './UnifiedGrid';

/**
 * ✅ 통합관리 화면 (DB 연동 + 렌더 트리거 + 세션 보장)
 */
export default function UnifiedManagement() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // ✅ 로그인 세션 확인 (쿠키 포함)
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (!data.ok) {
          window.location.href = '/login';
          return;
        }
        // ✅ 세션 확인 완료 후 DB 데이터 로드 트리거
        setReady(true);
      } catch {
        window.location.href = '/login';
      }
    })();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-gray-500">
        통합관리 데이터를 불러오는 중입니다...
      </div>
    );
  }

  // ✅ 세션 인증 완료 시 통합관리 화면 렌더
  return <UnifiedGrid viewId="통합관리" />;
}




