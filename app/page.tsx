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
        // ✅ 인증 여부는 sessionStorage로만 확인 (기존 흐름 유지)
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
  return <AppShell />;
}












