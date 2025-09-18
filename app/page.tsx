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

    const decide = () => {
      try {
        // ✅ 비밀번호 설정 여부는 'admin_pw_set' 플래그로 판단
        const pwSet = localStorage.getItem('admin_pw_set') === '1';

        if (!pwSet) {
          setView('admin'); // 비번 미설정 → 관리자 설정
          return;
        }

        // 비번 설정됨 → 인증 여부로 분기
        const auth = localStorage.getItem('erp_auth');
        const exp = localStorage.getItem('erp_auth_exp');
        const authed = auth === '1' && exp && Date.now() < Number(exp);

        if (!authed) {
          setView('login'); // 미인증 → 로그인 페이지로
          return;
        }

        setView('app'); // 인증됨 → 전체 앱
      } catch {
        setView('login');
      }
    };

    decide();
    // 혹시 다른 탭에서 비번 저장/로그인 상태 바뀌면 바로 반영
    window.addEventListener('storage', decide);
    return () => window.removeEventListener('storage', decide);
  }, []);

  // 라우팅
  useEffect(() => {
    if (view === 'login') router.replace('/login');
  }, [view, router]);

  if (view === 'loading') return null;
  if (view === 'admin')   return <div className="min-h-screen bg-gray-50 p-6"><AdminSetting /></div>;
  return <AppShell />;
}












