'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const f = new FormData(e.target);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
    });
    setBusy(false);
    if (res.ok) router.push('/dashboard');
    else setError((await res.json()).error || 'Sign in failed');
  }

  return (
    <main style={{ maxWidth: 360, margin: '12vh auto', padding: 24, background: '#fff', borderRadius: 12 }}>
      <h1 style={{ marginTop: 0 }}>FreshFlow</h1>
      <p style={{ color: '#5b6b61' }}>Sign in to manage perishable stock.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
        <input name="email" type="email" placeholder="Email" required />
        <input name="password" type="password" placeholder="Password" required />
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {error && <div role="alert" style={{ color: '#b3261e' }}>{error}</div>}
      </form>
    </main>
  );
}
