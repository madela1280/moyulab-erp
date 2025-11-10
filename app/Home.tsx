'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';

const AppShell = dynamic(() => import('./components/AppShell'), { ssr: false });

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data.ok) setAuthed(true);
        else router.replace('/login');
      } catch {
        router.replace('/login');
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, [router]);

  if (loading) return null;
  if (!authed) return null;

  return (
    <div className="flex flex-col w-full min-h-screen">
      <AppShell />
    </div>
  );
}
