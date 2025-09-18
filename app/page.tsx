'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import AdminSetting from './components/UserManagement/AdminSetting';

// App 전체(메뉴 포함)를 클라이언트에서만 로드
const AppShell = dynamic(() => import('./components/AppShell'), { ssr: false });

type View = 'loading' | 'admin' | 'app' | 'login';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>('loading');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const hasAdminPw = !!localStorage.getItem('admin_pw_hash'); // 비번 설정 여부
      const auth = localStorage.getItem('erp_auth');
      const exp = localStorage.getItem('erp_auth_exp');
      const authed = auth === '1' && exp && Date.now() < Number(exp);

      if (!hasAdminPw) { setView('admin'); return; }    // 비번 없으면 관리자 설정 먼저
      if (!authed)     { setView('login'); return; }    // 비번 있고 미인증 → 로그인
      setView('app');                                   // 인증됨 → 전체 앱
    } catch {
      setView('login');
    }
  }, []);

  // 라우팅
  useEffect(() => {
    if (view === 'login') router.replace('/login');
  }, [view, router]);

  if (view === 'loading') return null;
  if (view === 'admin')   return <div className="min-h-screen bg-gray-50 p-6"><AdminSetting /></div>;
  return <AppShell />;
}











