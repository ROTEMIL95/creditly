'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth';
import { apiError } from '../../lib/api';

const DEMO = [
  ['admin@creditly.dev', 'Admin'],
  ['manager@creditly.dev', 'Manager'],
  ['user@creditly.dev', 'User'],
  ['banker.alpha@creditly.dev', 'Banker (Alpha)'],
  ['banker.beta@creditly.dev', 'Banker (Beta)'],
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('admin@creditly.dev');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto mt-10 max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Sign in to Creditly</h1>
      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-indigo-600 py-2 font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm">
        <p className="mb-2 font-medium text-slate-600">Demo accounts (password: Password123!)</p>
        <div className="flex flex-wrap gap-2">
          {DEMO.map(([mail, label]) => (
            <button
              key={mail}
              onClick={() => setEmail(mail)}
              className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
