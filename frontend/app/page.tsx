'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'BANKER') router.replace('/auctions');
    else router.replace('/accounts');
  }, [user, loading, router]);

  return <p className="text-slate-500">Loading…</p>;
}
