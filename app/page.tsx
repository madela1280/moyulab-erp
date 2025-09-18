'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import AdminSetting from './components/UserManagement/AdminSetting';

const AppShell = dynamic(() => import('./components/AppShell'), { ssr: false });

type View = 'loading' | 'admin' | 'app' | 'login';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>('loading');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const decide = () => {
      try {
        // 비번 설정 여부는 플래그로 확인
        const pwSet = localStorage.getItem('admin_pw_set') === '1';
        if (!pwSet) { setView('admin'); return; }

        // ✅ 인증 여부는 sessionStorage로만 확인 (탭/세션 종료 시 자동 로그아웃)
        const authed = sessionStorage.getItem('erp_auth') === '1';
        if (!authed) { setView('login'); return; }

        setView('app');
      } catch {
        setView('login');
      }
    };

    decide();
    window.addEventListener('storage', decide);
    return () => window.removeEventListener('storage', decide);
  }, []);

  useEffect(() => {
    if (view === 'login') router.replace('/login');
  }, [view, router]);

  if (view === 'loading') return null;
  if (view === 'admin')   return <div className="min-h-screen bg-gray-50 p-6"><AdminSetting /></div>;
  return <AppShell />;
}










