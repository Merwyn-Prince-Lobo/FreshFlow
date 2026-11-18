
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

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: f.get('email'),
          password: f.get('password'),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Invalid email or password');
      }
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">

      <section className="login-brand">
        <div className="brand-circle circle-one" />
        <div className="brand-circle circle-two" />

        <div className="brand-logo">
          <div className="logo-icon">🌿</div>
          FreshFlow
        </div>

        <div className="brand-content">
          <div className="welcome-tag">
            SMART INVENTORY MANAGEMENT
          </div>

          <h1>
            Fresh stock.
            <br />
            <span>Less waste.</span>
            <br />
            More profit.
          </h1>

          <p>
            Take control of your perishable inventory.
            Track expiry dates, reduce food waste and
            keep your business running fresh.
          </p>

          <div className="produce-art">
            {['🥑', '🍊', '🥦', '🍎', '🥕'].map((item, i) => (
              <div className="produce-item" key={i}>
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="brand-footer">
          © 2026 FreshFlow. Smart inventory, fresher future.
        </div>
      </section>

      <section className="login-side">
        <div className="login-card">

          <div className="welcome-tag">
            👋 WELCOME BACK
          </div>

          <h2>Sign in</h2>

          <p className="login-description">
            Enter your credentials to access your workspace.
          </p>

          <form onSubmit={submit}>

            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              className="login-button"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Signing in...' : 'Sign in →'}
            </button>

            {error && (
              <div className="login-error" role="alert">
                {error}
              </div>
            )}

          </form>

          <div className="login-bottom">
            Secure access · FreshFlow Inventory System
          </div>

        </div>
      </section>

    </main>
  );
}