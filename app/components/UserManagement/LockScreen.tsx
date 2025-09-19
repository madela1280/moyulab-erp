'use client';
import { useEffect, useState } from 'react';

export default function LockScreen() {
  const [masterName, setMasterName] = useState('장대윤');
  useEffect(() => {
    try {
      const n = localStorage.getItem('admin_name');
      if (n && n.trim()) setMasterName(n);
    } catch {}
  }, []);

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center">
          {/* 간단 잠금 아이콘 */}
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="10" width="16" height="10" rx="2" stroke="#9ca3af" strokeWidth="2"/>
            <path d="M8 10V7a4 4 0 1 1 8 0v3" stroke="#9ca3af" strokeWidth="2" />
          </svg>
        </div>
        <p className="text-sm">
          <span className="text-blue-600 font-medium">(사용자추가/수정)</span> 메뉴 접근 권한이 없습니다.
        </p>
        <p className="text-sm mt-1">서비스를 이용하려면 회사 마스터에게 문의 바랍니다.</p>
        <p className="text-lg font-bold mt-2">우리회사마스터 : <span className="text-blue-700">{masterName}</span></p>
      </div>
    </div>
  );
}
