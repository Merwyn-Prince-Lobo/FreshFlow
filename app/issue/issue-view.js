'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LogoutButton from '@/app/dashboard/logout-button';

const menu = [
  { href: '/dashboard', label: 'Dashboard', icon: '▦' },
  { href: '/inventory', label: 'Inventory', icon: '▤' },
  { href: '/issue', label: 'Issue stock', icon: '↗' },
  { href: '/waste', label: 'Record waste', icon: '♲' },
  { href: '/alerts', label: 'Alerts', icon: '♧' },
  { href: '/temperature', label: 'Temperature', icon: '♨' },
];

export default function IssueView({ session }) {
  const [options, setOptions] = useState([]);
  const [selection, setSelection] = useState('');
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  async function loadOptions() {
    setLoading(true);
    try {
      const res = await fetch('/api/issue', { cache: 'no-store' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Could not load stock.');

      setOptions(data);
      setSelection((current) => {
        if (current && data.some(
          (item) => `${item.Product_ID}-${item.Location_ID}` === current
        )) return current;

        return data.length
          ? `${data[0].Product_ID}-${data[0].Location_ID}`
          : '';
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOptions();
  }, []);

  const selectedItem = useMemo(
    () => options.find(
      (item) => `${item.Product_ID}-${item.Location_ID}` === selection
    ),
    [options, selection]
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    const amount = Number(quantity);

    if (!selectedItem) {
      setMessage({ type: 'error', text: 'Please select a product and location.' });
      return;
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid positive whole number.' });
      return;
    }

    if (amount > Number(selectedItem.Available_Quantity)) {
      setMessage({
        type: 'error',
        text: `Only ${selectedItem.Available_Quantity} units are available.`
      });
      return;
    }

    if (!window.confirm(
      `Issue ${amount} ${selectedItem.Unit_Of_Measure} of ${selectedItem.Product_Name} from ${selectedItem.Location_Name}?`
    )) return;

    setSubmitting(true);

    try {
      const res = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: selectedItem.Product_ID,
          locationId: selectedItem.Location_ID,
          quantity: amount
        })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Stock issue failed.');

      setMessage({ type: 'success', text: data.message });
      setQuantity('');
      await loadOptions();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  const totalAvailable = options.reduce(
    (sum, item) => sum + Number(item.Available_Quantity || 0), 0
  );

  return (
    <div className="issue-layout">
      <aside className="issue-sidebar">
        <Link href="/dashboard" className="issue-brand">
          <span className="issue-brand-icon">🌿</span>
          <span>FreshFlow<small>Inventory Management</small></span>
        </Link>

        <div className="issue-nav-label">WORKSPACE</div>

        <nav className="issue-nav">
          {menu.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              className={`issue-nav-link ${item.href === '/issue' ? 'active' : ''}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="issue-sidebar-bottom">
          <div className="issue-user">
            <div className="issue-avatar">
              {(session.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{session.name}</strong>
              <small>{session.role}</small>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="issue-main">
        <header className="issue-topbar">
          <div>
            <span className="issue-breadcrumb">Workspace / Stock</span>
            <h1>Issue Stock</h1>
            <p>Issue available stock with automatic FEFO batch allocation.</p>
          </div>
          <Link href="/inventory" className="issue-outline-button">
            View inventory →
          </Link>
        </header>

        <section className="issue-stats">
          <div className="issue-stat-card">
            <span className="issue-stat-icon">📦</span>
            <div>
              <small>Available stock</small>
              <strong>{loading ? '—' : totalAvailable.toLocaleString()}</strong>
              <span>Non-expired units</span>
            </div>
          </div>
          <div className="issue-stat-card">
            <span className="issue-stat-icon">🥬</span>
            <div>
              <small>Product-location options</small>
              <strong>{loading ? '—' : options.length}</strong>
              <span>With available stock</span>
            </div>
          </div>
          <div className="issue-stat-card">
            <span className="issue-stat-icon">⏳</span>
            <div>
              <small>Issuing method</small>
              <strong>FEFO</strong>
              <span>Earliest expiry first</span>
            </div>
          </div>
        </section>

        <section className="issue-content-grid">
          <div className="issue-form-card">
            <div className="issue-card-heading">
              <div>
                <span className="issue-eyebrow">STOCK MOVEMENT</span>
                <h2>New stock issue</h2>
                <p>Choose the product, location and quantity.</p>
              </div>
              <span className="issue-heading-icon">↗</span>
            </div>

            {message && (
              <div className={`issue-message ${message.type}`}>
                {message.type === 'success' ? '✓' : '⚠'} {message.text}
              </div>
            )}

            {loading ? (
              <div className="issue-empty">Loading available stock...</div>
            ) : options.length === 0 ? (
              <div className="issue-empty">
                <span>📦</span>
                <h3>No available stock</h3>
                <p>There is currently no non-expired stock available to issue.</p>
                <Link href="/inventory">View inventory</Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="issue-form">
                <label htmlFor="issue-product">Product and location</label>
                <select
                  id="issue-product"
                  value={selection}
                  onChange={(e) => setSelection(e.target.value)}
                  required
                >
                  {options.map((item) => (
                    <option
                      key={`${item.Product_ID}-${item.Location_ID}`}
                      value={`${item.Product_ID}-${item.Location_ID}`}
                    >
                      {item.Product_Name} — {item.Location_Name}
                    </option>
                  ))}
                </select>

                {selectedItem && (
                  <div className="issue-availability">
                    <div>
                      <span>Available to issue</span>
                      <strong>
                        {Number(selectedItem.Available_Quantity).toLocaleString()}
                        {' '}{selectedItem.Unit_Of_Measure}
                      </strong>
                    </div>
                    <span className="issue-available-tag">In stock</span>
                  </div>
                )}

                <label htmlFor="issue-quantity">Quantity to issue</label>
                <div className="issue-quantity-wrap">
                  <input
                    id="issue-quantity"
                    type="number"
                    min="1"
                    max={selectedItem?.Available_Quantity || undefined}
                    step="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    required
                  />
                  <span>{selectedItem?.Unit_Of_Measure || 'Units'}</span>
                </div>

                <div className="issue-info-box">
                  <span>ℹ</span>
                  <div>
                    <strong>Automatic FEFO allocation</strong>
                    <p>
                      FreshFlow will issue stock from the batch with the
                      earliest expiry date first. Expired batches are excluded.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="issue-submit"
                  disabled={submitting || !selectedItem}
                >
                  {submitting ? 'Processing issue...' : 'Confirm stock issue →'}
                </button>
              </form>
            )}
          </div>

          <aside className="issue-guide-card">
            <div className="issue-guide-icon">🌱</div>
            <h2>How FEFO works</h2>
            <p>
              FEFO means First Expiry, First Out. FreshFlow automatically
              prioritises batches that expire sooner.
            </p>

            <div className="issue-guide-step">
              <span>01</span>
              <div>
                <strong>Select stock</strong>
                <small>Choose a product and storage location.</small>
              </div>
            </div>
            <div className="issue-guide-step">
              <span>02</span>
              <div>
                <strong>Enter quantity</strong>
                <small>Specify how many units you need to issue.</small>
              </div>
            </div>
            <div className="issue-guide-step">
              <span>03</span>
              <div>
                <strong>Automatic allocation</strong>
                <small>Earliest-expiring eligible batches are used first.</small>
              </div>
            </div>

            <div className="issue-guide-footer">
              <span>✓</span>
              Expired stock is automatically excluded.
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
