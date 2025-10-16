'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const AppShell = dynamic(() => import('./components/AppShell'), { ssr: false });

type View = 'loading' | 'app' | 'login';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<View>('loading');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const decide = () => {
      try {
        // ✅ localStorage와 sessionStorage 둘 다 검사 (시크릿 모드 대응)
        const authed =
          localStorage.getItem('erp_auth') === '1' ||
          sessionStorage.getItem('erp_auth') === '1';

        if (!authed) {
          setView('login');
          return;
        }
        setView('app');
      } catch {
        setView('login');
      }
    };

    // ✅ 로그인 직후 세션이 늦게 써지는 문제 방지
    setTimeout(decide, 200);

    window.addEventListener('storage', decide);
    return () => window.removeEventListener('storage', decide);
  }, []);

  useEffect(() => {
    if (view === 'login') router.replace('/login');
  }, [view, router]);

  if (view === 'loading') return null;
  return <AppShell />;
}














