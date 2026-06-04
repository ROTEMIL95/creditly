'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth';

export function Nav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <Link href="/" className="text-lg font-bold text-indigo-700">
          Creditly
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {user && user.role !== 'BANKER' && (
            <Link href="/accounts" className="hover:text-indigo-700">
              Accounts
            </Link>
          )}
          {user && (
            <Link href="/auctions" className="hover:text-indigo-700">
              Auctions
            </Link>
          )}
          {user ? (
            <>
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-600">
                {user.name} · <strong>{user.role}</strong>
              </span>
              <button
                onClick={() => {
                  logout();
                  router.push('/login');
                }}
                className="rounded bg-slate-800 px-3 py-1 text-white hover:bg-slate-700"
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/login" className="hover:text-indigo-700">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
