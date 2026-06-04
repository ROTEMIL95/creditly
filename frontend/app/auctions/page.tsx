'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';

interface Offer {
  id: string;
  bankId: string;
  interestRate: number;
  isWinner: boolean;
}
interface Auction {
  id: string;
  status: string;
  endsAt: string;
  winningOfferId: string | null;
  account?: { id: string; status: string; amount: number; customerName?: string };
  offers?: Offer[];
  myOffers?: Offer[];
  offerCount?: number;
}

export default function AuctionsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rate, setRate] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    api
      .get('/auctions')
      .then((res) => setAuctions(res.data.auctions))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace('/login');
    load();
  }, [user, authLoading, router, load]);

  async function submitOffer(id: string) {
    setError('');
    try {
      await api.post(`/auctions/${id}/offers`, { interestRate: Number(rate[id]) });
      setRate((r) => ({ ...r, [id]: '' }));
      load();
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function closeAuction(id: string) {
    setError('');
    try {
      await api.post(`/auctions/${id}/close`);
      load();
    } catch (err) {
      setError(apiError(err));
    }
  }

  if (loading) return <p className="text-slate-500">Loading auctions…</p>;

  const isBanker = user?.role === 'BANKER';
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Auctions</h1>
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>}

      <div className="space-y-4">
        {auctions.map((a) => (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-xs text-slate-400">{a.id}</p>
                <p className="mt-1">
                  <span className="font-medium">{a.status}</span>
                  {a.account && (
                    <span className="ml-2 text-sm text-slate-500">
                      · amount ${a.account.amount.toLocaleString()}
                      {a.account.customerName && ` · ${a.account.customerName}`}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-400">Ends: {new Date(a.endsAt).toLocaleString()}</p>
              </div>
              {canManage && a.status === 'OPEN' && (
                <button
                  onClick={() => closeAuction(a.id)}
                  className="rounded bg-slate-800 px-3 py-1 text-sm text-white hover:bg-slate-700"
                >
                  Close & pick winner
                </button>
              )}
            </div>

            {/* Banker: own offers + submission (Blind — no competitor visibility) */}
            {isBanker && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="text-sm text-slate-500">
                  Total offers: {a.offerCount ?? 0} (competitors hidden)
                </p>
                {a.myOffers && a.myOffers.length > 0 && (
                  <p className="text-sm">
                    Your offer: <strong>{a.myOffers[0].interestRate}%</strong>
                  </p>
                )}
                {a.status === 'OPEN' && (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Interest rate %"
                      value={rate[a.id] ?? ''}
                      onChange={(e) => setRate((r) => ({ ...r, [a.id]: e.target.value }))}
                      className="w-40 rounded border border-slate-300 px-3 py-1 text-sm"
                    />
                    <button
                      onClick={() => submitOffer(a.id)}
                      className="rounded bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500"
                    >
                      {a.myOffers && a.myOffers.length > 0 ? 'Update offer' : 'Submit offer'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Manager/Admin: full offer list */}
            {!isBanker && a.offers && a.offers.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-1 text-sm font-medium text-slate-600">Offers</p>
                <ul className="space-y-1 text-sm">
                  {a.offers.map((o) => (
                    <li key={o.id} className="flex justify-between">
                      <span className="font-mono text-xs text-slate-500">{o.bankId}</span>
                      <span>
                        {o.interestRate}%{' '}
                        {o.isWinner && <span className="ml-1 rounded bg-green-100 px-2 text-green-700">winner</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {auctions.length === 0 && <p className="text-slate-400">No auctions available to your role.</p>}
      </div>
    </div>
  );
}
