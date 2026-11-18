
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LogoutButton from './logout-button';

const icons = {
  '/inventory': '📦',
  '/issue': '🚚',
  '/waste': '♻️',
  '/alerts': '🔔',
  '/temperature': '🌡️',
  '/suppliers': '🏪',
  '/users': '👥',
  '/analytics': '📊',
  '/reports': '📑',
  '/audit': '🛡️',
};

function getDays(item) {
  const value = Number(item.Days_To_Expiry);
  return Number.isFinite(value) ? value : null;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function DashboardView({ session, items }) {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadInventory() {
      try {
        const response = await fetch('/api/inventory', {
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error('Could not load inventory data.');
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(data.error || 'Unexpected inventory response.');
        }

        if (active) setInventory(data);
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadInventory();

    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const units = inventory.reduce(
      (sum, item) => sum + (Number(item.Quantity_On_Hand) || 0),
      0
    );

    const expiring = inventory.filter((item) => {
      const days = getDays(item);
      return days !== null && days >= 0 && days <= 7;
    });

    const expired = inventory.filter((item) => {
      const days = getDays(item);
      return days !== null && days < 0;
    });

    const products = new Set(
      inventory.map((item) => item.Product_Name)
    ).size;

    return {
      products,
      units,
      batches: inventory.length,
      expiring: expiring.length,
      expired: expired.length,
    };
  }, [inventory]);

  const locations = useMemo(() => {
    const result = {};

    inventory.forEach((item) => {
      const name = item.Location_Name || 'Unspecified';
      result[name] = (result[name] || 0) +
        (Number(item.Quantity_On_Hand) || 0);
    });

    return Object.entries(result)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [inventory]);

  const urgentBatches = useMemo(() => {
    return [...inventory]
      .filter((item) => getDays(item) !== null)
      .sort((a, b) => getDays(a) - getDays(b))
      .slice(0, 6);
  }, [inventory]);

  const maxLocation = Math.max(
    1,
    ...locations.map((location) => location[1])
  );

  return (
    <div className="dashboard-layout">

      <aside className="dashboard-sidebar">
        <Link href="/dashboard" className="dashboard-logo">
          <span className="dashboard-logo-icon">🌿</span>
          <span>FreshFlow</span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>

        <Link href="/dashboard" className="nav-link active">
          <span>🏠</span> Dashboard
        </Link>

        <div className="sidebar-label">DAILY OPERATIONS</div>

        {items.filter((item) =>
          ['/inventory', '/issue', '/waste', '/alerts', '/temperature']
            .includes(item.href)
        ).map((item) => (
          <Link href={item.href} className="nav-link" key={item.href}>
            <span>{icons[item.href]}</span>
            {item.label}
          </Link>
        ))}

        {session.role === 'Admin' && (
          <>
            <div className="sidebar-label">MANAGEMENT</div>
            {items.filter((item) =>
              ['/suppliers', '/users', '/analytics', '/reports', '/audit']
                .includes(item.href)
            ).map((item) => (
              <Link href={item.href} className="nav-link" key={item.href}>
                <span>{icons[item.href]}</span>
                {item.label}
              </Link>
            ))}
          </>
        )}

        <div className="sidebar-bottom">
          <div className="sidebar-profile">
            <div className="profile-avatar">
              {(session.name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="profile-details">
              <strong>{session.name}</strong>
              <span>{session.role}</span>
            </div>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <main className="dashboard-main">

        <header className="dashboard-topbar">
          <div>
            <span className="breadcrumb">Workspace / Dashboard</span>
            <h1>Dashboard Overview</h1>
          </div>

          <div className="topbar-right">
            <span className="live-status">
              <span className="live-dot"></span>
              Inventory overview
            </span>
            <div className="topbar-avatar">
              {(session.name || 'U').charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <section className="welcome-banner">
          <div>
            <span className="welcome-eyebrow">
              🌱 YOUR INVENTORY AT A GLANCE
            </span>
            <h2>Hello, {session.name}! 👋</h2>
            <p>
              Here's what's happening with your fresh stock today.
              Stay ahead of expiry and reduce waste.
            </p>
          </div>
          <div className="welcome-illustration">🥬</div>
          <div className="welcome-decoration"></div>
        </section>

        <section className="section-heading">
          <div>
            <h2>Inventory Summary</h2>
            <p>Monitor your stock performance</p>
          </div>
          <Link href="/inventory" className="outline-action">
            View inventory →
          </Link>
        </section>

        {error && (
          <div className="dashboard-error">
            ⚠️ {error}
          </div>
        )}

        <section className="stats-grid">

          <article className="stat-card stat-green">
            <div className="stat-top">
              <span className="stat-icon">🛒</span>
              <span className="stat-caption">PRODUCTS</span>
            </div>
            <h3>{loading ? '—' : stats.products}</h3>
            <p>Unique products tracked</p>
            <div className="stat-decoration">📦</div>
          </article>

          <article className="stat-card stat-blue">
            <div className="stat-top">
              <span className="stat-icon">📦</span>
              <span className="stat-caption">TOTAL STOCK</span>
            </div>
            <h3>{loading ? '—' : stats.units.toLocaleString('en-IN')}</h3>
            <p>Units currently recorded</p>
            <div className="stat-decoration">🏬</div>
          </article>

          <article className="stat-card stat-orange">
            <div className="stat-top">
              <span className="stat-icon">⏳</span>
              <span className="stat-caption">EXPIRING SOON</span>
            </div>
            <h3>{loading ? '—' : stats.expiring}</h3>
            <p>Batches expiring within 7 days</p>
            <div className="stat-decoration">⚠️</div>
          </article>

          <article className="stat-card stat-red">
            <div className="stat-top">
              <span className="stat-icon">🚨</span>
              <span className="stat-caption">EXPIRED STOCK</span>
            </div>
            <h3>{loading ? '—' : stats.expired}</h3>
            <p>Expired batches requiring attention</p>
            <div className="stat-decoration">📉</div>
          </article>

        </section>

        <section className="analytics-grid">

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h3>Expiry Risk Monitor</h3>
                <p>Batch count grouped by expiry timeline</p>
              </div>
              <span className="panel-icon">📊</span>
            </div>

            {loading ? (
              <div className="empty-state">Loading inventory...</div>
            ) : (
              <div className="risk-chart">
                {[
                  {
                    label: 'Expired',
                    count: stats.expired,
                    color: '#e85d62',
                  },
                  {
                    label: '0–7 days',
                    count: stats.expiring,
                    color: '#f4a340',
                  },
                  {
                    label: '8–15 days',
                    count: inventory.filter((item) => {
                      const d = getDays(item);
                      return d !== null && d >= 8 && d <= 15;
                    }).length,
                    color: '#e6c44d',
                  },
                  {
                    label: '16+ days',
                    count: inventory.filter((item) => {
                      const d = getDays(item);
                      return d !== null && d > 15;
                    }).length,
                    color: '#27a66c',
                  },
                ].map((bar) => (
                  <div className="risk-row" key={bar.label}>
                    <span className="risk-label">{bar.label}</span>
                    <div className="risk-track">
                      <div
                        className="risk-fill"
                        style={{
                          width: `${inventory.length
                            ? Math.max(2, bar.count / inventory.length * 100)
                            : 0}%`,
                          background: bar.color,
                        }}
                      />
                    </div>
                    <strong>{bar.count}</strong>
                  </div>
                ))}
              </div>
            )}

            <div className="chart-footer">
              Based on {loading ? '—' : stats.batches} inventory batches
            </div>
          </article>

          <article className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h3>Stock by Location</h3>
                <p>Distribution across storage areas</p>
              </div>
              <span className="panel-icon">📍</span>
            </div>

            {loading ? (
              <div className="empty-state">Loading locations...</div>
            ) : locations.length === 0 ? (
              <div className="empty-state">No stock locations found.</div>
            ) : (
              <div className="location-list">
                {locations.map(([name, quantity], index) => (
                  <div className="location-row" key={name}>
                    <div className="location-info">
                      <span className={`location-dot dot-${index}`}></span>
                      <span>{name}</span>
                      <strong>{quantity.toLocaleString('en-IN')}</strong>
                    </div>
                    <div className="location-track">
                      <div
                        style={{
                          width: `${quantity / maxLocation * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="chart-footer">
              Quantity of stock by location
            </div>
          </article>

        </section>

        <section className="dashboard-panel urgent-panel">
          <div className="panel-heading">
            <div>
              <h3>⚡ Batches Needing Attention</h3>
              <p>Prioritised by earliest expiry date (FEFO)</p>
            </div>
            <Link href="/inventory" className="panel-link">
              All batches →
            </Link>
          </div>

          <div className="table-scroll">
            <table className="modern-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch number</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Expiry date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      Loading batches...
                    </td>
                  </tr>
                ) : urgentBatches.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="empty-state">
                      No inventory batches available.
                    </td>
                  </tr>
                ) : urgentBatches.map((item) => {
                  const days = getDays(item);
                  const expired = days < 0;
                  const urgent = days <= 7;

                  return (
                    <tr key={item.Inventory_ID}>
                      <td><strong>{item.Product_Name}</strong></td>
                      <td>{item.Batch_Number}</td>
                      <td>{item.Location_Name}</td>
                      <td>{item.Quantity_On_Hand}</td>
                      <td>{formatDate(item.Expiry_Date)}</td>
                      <td>
                        <span className={
                          `status-badge ${
                            expired ? 'status-expired' :
                            urgent ? 'status-urgent' : 'status-safe'
                          }`
                        }>
                          {expired
                            ? 'Expired'
                            : days === 0
                              ? 'Expires today'
                              : `${days} days left`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="dashboard-footer">
          <span>🌿 FreshFlow Inventory Management</span>
          <span>Smart stock management · Less waste · More freshness</span>
        </footer>

      </main>
    </div>
  );
}
