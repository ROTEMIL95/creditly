'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, apiError } from '../../../lib/api';
import { useAuth } from '../../../lib/auth';
import { humanizeEnum } from '../../../lib/labels';

interface Detail {
  account: {
    id: string;
    customerName: string;
    phone: string;
    email: string;
    status: string;
    amount: number;
    isHighActivity: boolean;
    manager?: { name: string };
  };
  auctions: { id: string; status: string; endsAt: string }[];
  events: { id: string; type: string; createdAt: string }[];
}

function AccountDetail() {
  // Static export can't pre-render path params, so the account id comes from the query
  // string (?id=...) and is read client-side. See the link in app/accounts/page.tsx.
  const id = useSearchParams().get('id');
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [eventType, setEventType] = useState('NOTE_ADDED');
  const [note, setNote] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api
      .get(`/accounts/${id}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace('/login');
    load();
  }, [user, authLoading, router, load]);

  async function openAuction() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/accounts/${id}/auctions`);
      load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  async function addEvent() {
    setAddingEvent(true);
    setError('');
    try {
      await api.post('/events', {
        accountId: id,
        type: eventType,
        ...(note.trim() ? { payload: { note: note.trim() } } : {}),
      });
      setNote('');
      load(); // refresh events + account (e.g. new High Activity / lastActivity)
    } catch (err) {
      setError(apiError(err));
    } finally {
      setAddingEvent(false);
    }
  }

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>;
  if (!data) return null;

  const { account, auctions, events } = data;
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const hasOpenAuction = auctions.some((a) => a.status === 'OPEN');

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{account.customerName}</h1>
            <p className="text-sm text-slate-500">
              {account.email} · {account.phone}
            </p>
          </div>
          {account.isHighActivity && (
            <span className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-800">High Activity</span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><dt className="text-slate-400">Status</dt><dd className="font-medium">{humanizeEnum(account.status)}</dd></div>
          <div><dt className="text-slate-400">Amount</dt><dd className="font-medium">${account.amount.toLocaleString()}</dd></div>
          <div><dt className="text-slate-400">Manager</dt><dd className="font-medium">{account.manager?.name ?? '—'}</dd></div>
        </dl>
        {canManage && !hasOpenAuction && (
          <button
            onClick={openAuction}
            disabled={busy}
            className="mt-4 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Opening…' : 'Open auction'}
          </button>
        )}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">Auctions</h2>
        {auctions.length === 0 ? (
          <p className="text-sm text-slate-400">No auctions.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {auctions.map((a) => (
              <li key={a.id} className="flex justify-between rounded border border-slate-100 px-3 py-2">
                <span className="text-slate-600">Auction · ends {new Date(a.endsAt).toLocaleDateString()}</span>
                <span className="font-medium">{humanizeEnum(a.status)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-3 font-semibold">Events</h2>

        {/* Create event (admin / manager / user). Drives the business logic:
            >3 events/24h → High Activity; document_uploaded → lastActivity + CRM sync. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1 text-sm"
          >
            <option value="NOTE_ADDED">Note added</option>
            <option value="STATUS_CHANGED">Status changed</option>
            <option value="DOCUMENT_UPLOADED">Document uploaded</option>
          </select>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="min-w-48 flex-1 rounded border border-slate-300 px-3 py-1 text-sm"
          />
          <button
            onClick={addEvent}
            disabled={addingEvent}
            className="rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {addingEvent ? 'Adding…' : 'Add event'}
          </button>
        </div>

        <ul className="space-y-1 text-sm">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between border-b border-slate-50 py-1">
              <span className="font-medium">{humanizeEnum(e.type)}</span>
              <span className="text-slate-400">{new Date(e.createdAt).toLocaleString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function AccountDetailPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <AccountDetail />
    </Suspense>
  );
}
