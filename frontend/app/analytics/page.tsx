'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { humanizeEnum } from '../../lib/labels';

interface Summary {
  totalAccounts: number;
  highActivityAccounts: number;
  accountsByStatus: Record<string, number>;
  auctions: { open: number; won: number; expired: number };
  totalOffers: number;
  failedSyncs: number;
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${accent ?? 'text-slate-900'}`}>{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace('/login');
    if (user.role !== 'ADMIN') return router.replace('/accounts'); // admin-only dashboard
    api
      .get('/analytics/summary')
      .then((res) => setSummary(res.data.summary))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  if (loading) return <p className="text-slate-500">Loading dashboard…</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>;
  if (!summary) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Accounts" value={summary.totalAccounts} />
        <Stat label="High activity" value={summary.highActivityAccounts} accent="text-amber-600" />
        <Stat label="Total offers" value={summary.totalOffers} />
        <Stat label="Failed CRM syncs" value={summary.failedSyncs} accent={summary.failedSyncs > 0 ? 'text-red-600' : 'text-green-600'} />
        <Stat label="Open auctions" value={summary.auctions.open} accent="text-indigo-600" />
        <Stat label="Won auctions" value={summary.auctions.won} accent="text-green-600" />
        <Stat label="Expired auctions" value={summary.auctions.expired} accent="text-slate-500" />
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">Accounts by status</h2>
        {Object.keys(summary.accountsByStatus).length === 0 ? (
          <p className="text-sm text-slate-400">No accounts.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {Object.entries(summary.accountsByStatus).map(([status, count]) => (
              <li key={status} className="flex justify-between border-b border-slate-50 py-1">
                <span className="text-slate-600">{humanizeEnum(status)}</span>
                <span className="font-medium">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
