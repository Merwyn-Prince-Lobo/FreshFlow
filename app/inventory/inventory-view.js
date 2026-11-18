
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import LogoutButton from '../dashboard/logout-button';

const menu = [
  ['🏠', 'Dashboard', '/dashboard'],
  ['📦', 'Inventory', '/inventory'],
  ['🚚', 'Issue stock', '/issue'],
  ['♻️', 'Record waste', '/waste'],
  ['🔔', 'Alerts', '/alerts'],
  ['🌡️', 'Temperature', '/temperature'],
  ['🏪', 'Suppliers & products', '/suppliers'],
  ['👥', 'Users', '/users'],
  ['📊', 'Waste analytics', '/analytics'],
  ['📑', 'Reports', '/reports'],
  ['🛡️', 'Audit trail', '/audit'],
];

function daysLeft(item) {
  const value = Number(item.Days_To_Expiry);
  return Number.isFinite(value) ? value : null;
}

function expiryStatus(item) {
  const days = daysLeft(item);

  if (days === null) return { label: 'Unknown', className: 'inv-unknown' };
  if (days < 0) return { label: 'Expired', className: 'inv-expired' };
  if (days === 0) return { label: 'Expires today', className: 'inv-urgent' };
  if (days <= 7) return { label: 'Expiring soon', className: 'inv-urgent' };
  if (days <= 15) return { label: 'Upcoming', className: 'inv-warning' };

  return { label: 'Fresh stock', className: 'inv-fresh' };
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

export default function InventoryView({ session }) {
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadInventory(searchTerm = '') {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/inventory?q=${encodeURIComponent(searchTerm)}`,
        { cache: 'no-store' }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to load inventory.');
      }

      if (!Array.isArray(data)) {
        throw new Error('Unexpected inventory response.');
      }

      setInventory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory();
  }, []);

  const filtered = useMemo(() => {
    let result = [...inventory];

    if (filter !== 'All') {
      result = result.filter((item) => {
        const days = daysLeft(item);

        if (filter === 'Expired') return days !== null && days < 0;
        if (filter === 'Expiring') return days !== null && days >= 0 && days <= 7;
        if (filter === 'Fresh') return days !== null && days > 7;

        return true;
      });
    }

    return result.sort((a, b) => {
      const da = daysLeft(a) ?? Infinity;
      const db = daysLeft(b) ?? Infinity;
      return da - db;
    });
  }, [inventory, filter]);

  const totalUnits = inventory.reduce(
    (sum, item) => sum + (Number(item.Quantity_On_Hand) || 0),
    0
  );

  const expiredCount = inventory.filter(
    (item) => daysLeft(item) !== null && daysLeft(item) < 0
  ).length;

  const expiringCount = inventory.filter(
    (item) => daysLeft(item) !== null &&
      daysLeft(item) >= 0 && daysLeft(item) <= 7
  ).length;

  function handleSearch(e) {
    e.preventDefault();
    loadInventory(search.trim());
  }

  return (
    <div className="dashboard-layout">

      <aside className="dashboard-sidebar">
        <Link href="/dashboard" className="dashboard-logo">
          <span className="dashboard-logo-icon">🌿</span>
          <span>FreshFlow</span>
        </Link>

        <div className="sidebar-label">WORKSPACE</div>

        {menu.map(([icon, label, href]) => {
          const adminOnly = [
            '/suppliers', '/users', '/analytics', '/reports', '/audit'
          ].includes(href);

          if (adminOnly && session.role !== 'Admin') return null;

          return (
            <Link
              href={href}
              key={href}
              className={`nav-link ${href === '/inventory' ? 'active' : ''}`}
            >
              <span>{icon}</span>
              {label}
            </Link>
          );
        })}

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
            <span className="breadcrumb">Workspace / Inventory</span>
            <h1>Inventory Management</h1>
          </div>
          <div className="topbar-avatar">
            {(session.name || 'U').charAt(0).toUpperCase()}
          </div>
        </header>

        <section className="inventory-banner">
          <div>
            <span>📦 STOCK CONTROL CENTER</span>
            <h2>Manage your fresh stock</h2>
            <p>
              Track products, monitor expiry dates and prioritise
              stock using FEFO.
            </p>
          </div>
          <div className="inventory-banner-icon">🥬</div>
        </section>

        <section className="inventory-stats">

          <div className="inventory-stat inv-stat-green">
            <span>📦</span>
            <p>Total batches</p>
            <h2>{inventory.length}</h2>
          </div>

          <div className="inventory-stat inv-stat-blue">
            <span>🛒</span>
            <p>Total units</p>
            <h2>{totalUnits.toLocaleString('en-IN')}</h2>
          </div>

          <div className="inventory-stat inv-stat-orange">
            <span>⏳</span>
            <p>Expiring within 7 days</p>
            <h2>{expiringCount}</h2>
          </div>

          <div className="inventory-stat inv-stat-red">
            <span>🚨</span>
            <p>Expired batches</p>
            <h2>{expiredCount}</h2>
          </div>

        </section>

        <section className="dashboard-panel inventory-content">

          <div className="panel-heading">
            <div>
              <h3>📋 Stock Inventory</h3>
              <p>View and manage your available inventory batches</p>
            </div>
            <span className="inventory-count">
              {filtered.length} records
            </span>
          </div>

          <form className="inventory-toolbar" onSubmit={handleSearch}>
            <div className="inventory-search">
              <span>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search product or batch number..."
              />
            </div>

            <button className="inventory-search-button" type="submit">
              Search
            </button>

            <button
              className="inventory-reset-button"
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('All');
                loadInventory('');
              }}
            >
              Reset
            </button>
          </form>

          <div className="inventory-filters">
            {['All', 'Expired', 'Expiring', 'Fresh'].map((name) => (
              <button
                type="button"
                key={name}
                className={`inventory-filter ${filter === name ? 'selected' : ''}`}
                onClick={() => setFilter(name)}
              >
                {name}
              </button>
            ))}
          </div>

          {error && (
            <div className="dashboard-error">
              ⚠️ {error}
              <button onClick={() => loadInventory(search)}>Retry</button>
            </div>
          )}

          <div className="table-scroll">
            <table className="modern-table inventory-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Batch number</th>
                  <th>Location</th>
                  <th>Quantity</th>
                  <th>Expiry date</th>
                  <th>Days left</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      Loading inventory...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="empty-state">
                      No inventory records found.
                    </td>
                  </tr>
                ) : filtered.map((item, index) => {
                  const status = expiryStatus(item);
                  const days = daysLeft(item);

                  return (
                    <tr key={item.Inventory_ID ?? index}>
                      <td>
                        <strong>{item.Product_Name}</strong>
                      </td>
                      <td>{item.Batch_Number}</td>
                      <td>{item.Location_Name}</td>
                      <td>
                        <strong>{item.Quantity_On_Hand}</strong>
                      </td>
                      <td>{formatDate(item.Expiry_Date)}</td>
                      <td>
                        {days === null
                          ? '—'
                          : days < 0
                            ? `${Math.abs(days)} days overdue`
                            : days === 0
                              ? 'Today'
                              : `${days} days`}
                      </td>
                      <td>
                        <span className={`status-badge ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="inventory-note">
            <span>💡</span>
            <p>
              <strong>FEFO principle:</strong> First Expiry, First Out.
              Prioritise batches with the earliest expiry dates.
            </p>
          </div>

        </section>

        <footer className="dashboard-footer">
          <span>🌿 FreshFlow Inventory Management</span>
          <span>Smart stock management · Less waste</span>
        </footer>

      </main>
    </div>
  );
}
