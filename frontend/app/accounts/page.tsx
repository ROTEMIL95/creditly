'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Account {
  id: string;
  customerName: string;
  status: string;
  amount: number;
  isHighActivity: boolean;
  manager?: { name: string };
}

export default function AccountsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace('/login');
    api
      .get('/accounts')
      .then((res) => setAccounts(res.data.accounts))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (loading) return <p className="text-slate-500">Loading accounts…</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>;

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Accounts</h1>
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2">Customer</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Manager</th>
              <th className="px-4 py-2">Activity</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/accounts/${a.id}`} className="font-medium text-indigo-700 hover:underline">
                    {a.customerName}
                  </Link>
                </td>
                <td className="px-4 py-2">{a.status}</td>
                <td className="px-4 py-2">${a.amount.toLocaleString()}</td>
                <td className="px-4 py-2">{a.manager?.name ?? '—'}</td>
                <td className="px-4 py-2">
                  {a.isHighActivity ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">High</span>
                  ) : (
                    <span className="text-slate-400">Normal</span>
                  )}
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No accounts visible to your role.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
