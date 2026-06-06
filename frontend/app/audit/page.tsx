'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, apiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { humanizeEnum } from '../../lib/labels';

interface AuditEntry {
  id: string;
  action: string;
  actor: { name: string; email: string; role: string } | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
  createdAt: string;
}

// Turn an entry's metadata into a short human-readable detail string.
function details(action: string, m: AuditEntry['metadata']): string {
  if (!m) return '';
  if (action === 'OFFER_UPDATED') return `${m.previousRate}% → ${m.interestRate}%`;
  if (action === 'OFFER_SUBMITTED') return `${m.interestRate}%`;
  if (action === 'CRM_SYNC') {
    return `${humanizeEnum(String(m.trigger))} · ${m.syncStatus}${m.failureReason ? ` (${m.failureReason})` : ''}`;
  }
  if (action === 'LOGIN_FAILURE') return String(m.reason ?? 'failed');
  if (m.note) return String(m.note);
  return Object.entries(m)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

function who(e: AuditEntry): string {
  if (e.actor) return `${e.actor.name} · ${e.actor.role}`;
  if (e.actorEmail) return `${e.actorEmail} (unauthenticated)`;
  return 'system';
}

export default function AuditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    if (authLoading) return;
    if (!user) return router.replace('/login');
    if (user.role !== 'ADMIN') return router.replace('/accounts'); // admin-only
    api
      .get('/audit')
      .then((res) => setEntries(res.data.audit))
      .catch((err) => setError(apiError(err)))
      .finally(() => setLoading(false));
  }, [user, authLoading, router]);

  const actions = useMemo(() => ['ALL', ...Array.from(new Set(entries.map((e) => e.action)))], [entries]);
  const shown = filter === 'ALL' ? entries : entries.filter((e) => e.action === filter);

  if (loading) return <p className="text-slate-500">Loading audit trail…</p>;
  if (error) return <p className="rounded bg-red-50 px-3 py-2 text-red-700">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        >
          {actions.map((a) => (
            <option key={a} value={a}>
              {a === 'ALL' ? 'All actions' : humanizeEnum(a)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-4 py-2">Time</th>
              <th className="px-4 py-2">Actor</th>
              <th className="px-4 py-2">Action</th>
              <th className="px-4 py-2">Entity</th>
              <th className="px-4 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} className="border-t border-slate-100 align-top">
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                  {new Date(e.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-2">{who(e)}</td>
                <td className="px-4 py-2 font-medium">{humanizeEnum(e.action)}</td>
                <td className="px-4 py-2 text-slate-500">
                  {e.entityType ? humanizeEnum(e.entityType) : '—'}
                </td>
                <td className="px-4 py-2 text-slate-700">{details(e.action, e.metadata)}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
                  No audit entries.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
