'use client';

import { useEffect, useState } from 'react';
import AdminSetting from './AdminSetting';
import LockScreen from './LockScreen';

const ADMIN_ID_FIXED = 'medela1280';

export default function AdminSettingCentered() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const authed = sessionStorage.getItem('erp_auth') === '1';
      const uid = sessionStorage.getItem('erp_user') || localStorage.getItem('erp_user') || '';
      setIsAdmin(authed && uid === ADMIN_ID_FIXED);
    } catch {
      setIsAdmin(false);
    }
  }, []);

  if (isAdmin === null) return null;        // 초기 로딩
  if (!isAdmin) return <LockScreen />;      // 비관리자 → 잠금화면

  return (
    <div className="min-h-[calc(100vh-80px)] flex items-start justify-center">
      <div className="mt-6">
        <AdminSetting />
      </div>
    </div>
  );
}

