'use client';

import { useEffect, useState } from 'react';
import AdminSetting from './AdminSetting';
import LockScreen from './LockScreen';
import { getCurrentUser, isAdmin } from '@/app/lib/permissions';

const ADMIN_ID_FIXED = 'medela1280';

export default function AdminSettingCentered() {
  const [isAdminUser, setIsAdminUser] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      // 기존 세션 체크 유지
      const authed = sessionStorage.getItem('erp_auth') === '1';
      const uid = sessionStorage.getItem('erp_user') || localStorage.getItem('erp_user') || '';

      // 새 권한 유틸도 함께 활용
      const current = getCurrentUser();
      const adminCheck = (authed && uid === ADMIN_ID_FIXED) || (current && isAdmin(current));

      setIsAdminUser(!!adminCheck);
    } catch {
      setIsAdminUser(false);
    }
  }, []);

  if (isAdminUser === null) return null;   // 초기 로딩 중
  if (!isAdminUser) return <LockScreen />; // 비관리자 → 잠금화면

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-start justify-center">
      <div className="mt-6">
        <AdminSetting />
      </div>
    </div>
  );
}


