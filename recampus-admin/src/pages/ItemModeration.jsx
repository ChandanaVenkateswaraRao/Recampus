import React, { useEffect, useMemo, useState } from 'react';
import { Check, Pause, Search, Trash2 } from 'lucide-react';
import { adminDeleteItem, fetchAdminItems, moderateItem } from '../api/adminApi';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatCurrency = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return '-';
  return `Rs.${value.toFixed(2)}`;
};

const toNameFromEmail = (email) => {
  const value = String(email || '').trim();
  if (!value.includes('@')) return value || '-';
  const base = value.split('@')[0].replace(/[._-]+/g, ' ').trim();
  if (!base) return value;
  return base
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const getItemStatusClass = (status) => {
  const value = String(status || '').toLowerCase();
  if (value === 'approved') return 'approved';
  if (value === 'pending') return 'pending';
  if (value === 'hold') return 'hold';
  if (value === 'sold') return 'sold';
  if (value === 'pending_handover') return 'handover';
  return 'default';
};

const ItemModeration = () => {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState('approval');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyItemId, setBusyItemId] = useState('');
  const [feedback, setFeedback] = useState('');

  const statusByTab = {
    approval: 'pending',
    sold: 'sold',
    onWebsite: 'approved'
  };

  const loadItems = async () => {
    try {
      setLoading(true);
      const status = statusByTab[activeTab] || 'pending';
      const res = await fetchAdminItems({ status, search, page: 1, limit: 200 });
      setItems(Array.isArray(res?.data?.items) ? res.data.items : []);
    } catch (_) {
      setItems([]);
      setFeedback('Unable to fetch item moderation data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [activeTab, search]);

  const moderate = async (id, nextStatus) => {
    let suggestedPrice;
    let note = '';

    if (nextStatus === 'hold') {
      const priceInput = window.prompt('Enter a suggested price (Rs) for seller:', '0');
      if (priceInput === null) return;
      suggestedPrice = Number(priceInput);
      if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) {
        setFeedback('Suggested price must be a valid amount greater than 0.');
        return;
      }
    }

    if (nextStatus === 'rejected') {
      note = window.prompt('Enter rejection reason (shown in audit):', 'Rejected by admin moderation') || '';
      if (!String(note).trim()) {
        setFeedback('Please provide a rejection reason.');
        return;
      }
    }

    if (nextStatus === 'approved') {
      note = window.prompt('Optional approval note:', 'Approved by admin') || '';
    }

    try {
      setBusyItemId(id);
      await moderateItem(id, {
        status: nextStatus,
        suggestedPrice,
        note
      });
      setFeedback(`Item updated to ${nextStatus}.`);
      await loadItems();
    } catch (_) {
      setFeedback('Error updating item status.');
    } finally {
      setBusyItemId('');
    }
  };

  const tabTitle = useMemo(() => {
    if (activeTab === 'sold') return 'Sold Items';
    if (activeTab === 'onWebsite') return 'On-Website Items';
    return 'For Approval Items';
  }, [activeTab]);

  const handleAdminDelete = async (itemId) => {
    const ok = window.confirm('Delete this product permanently? This action cannot be undone.');
    if (!ok) return;

    try {
      setBusyItemId(itemId);
      await adminDeleteItem(itemId);
      setFeedback('Item deleted by admin.');
      await loadItems();
    } catch (_) {
      setFeedback('Failed to delete item.');
    } finally {
      setBusyItemId('');
    }
  };

  const onSearchSubmit = (event) => {
    event.preventDefault();
    setSearch(searchInput.trim());
  };

  return (
    <div className="admin-dashboard items-admin-page">
      <header className="admin-header items-header">
        <h1>Item Moderation</h1>
        <p>Manage product approvals, sold history, and active on-website listings.</p>
      </header>

      <div className="rides-filter-row item-tab-row">
        <button
          type="button"
          className={activeTab === 'approval' ? 'active' : ''}
          onClick={() => setActiveTab('approval')}
        >
          For Approval
        </button>
        <button
          type="button"
          className={activeTab === 'sold' ? 'active' : ''}
          onClick={() => setActiveTab('sold')}
        >
          Sold
        </button>
        <button
          type="button"
          className={activeTab === 'onWebsite' ? 'active' : ''}
          onClick={() => setActiveTab('onWebsite')}
        >
          On-Website
        </button>
      </div>

      <div className="admin-card item-toolbar">
        <form className="ride-monitor-search" onSubmit={onSearchSubmit}>
          <Search size={16} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search title, category, seller, moderation note"
          />
          <button type="submit">Apply</button>
        </form>

        <button type="button" className="ride-action-btn" onClick={loadItems}>
          Refresh
        </button>
      </div>

      {feedback && (
        <div className="ride-flag-alert info">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback('')}>Dismiss</button>
        </div>
      )}

      <div className="admin-card item-section-card">
        <div className="ride-monitor-header-row item-section-head">
          <h2>{tabTitle} ({items.length})</h2>
          <span>
            {activeTab === 'approval'
              ? 'New listed items awaiting admin approval'
              : activeTab === 'sold'
                ? 'Product name, seller, buyer, and price'
                : 'Products currently listed on website'}
          </span>
        </div>

        <div className="item-table-wrap">
        <table className="admin-table item-admin-table">
          <thead>
            {activeTab === 'sold' ? (
              <tr>
                <th>Product Name</th>
                <th>Owner Name</th>
                <th>Owner Email</th>
                <th>Buyer Name</th>
                <th>Buyer Email</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            ) : activeTab === 'onWebsite' ? (
              <tr>
                <th>Product Name</th>
                <th>Owner Name</th>
                <th>Owner Email</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            ) : (
              <tr>
                <th>Product Name</th>
                <th>Owner Name</th>
                <th>Owner Email</th>
                <th>Price</th>
                <th>Actions</th>
              </tr>
            )}
          </thead>
          <tbody>
            {items.length > 0 ? items.map((item) => (
              activeTab === 'sold' ? (
                <tr key={item._id}>
                  <td>
                    <strong>{item?.title || '-'}</strong>
                    <div className={`item-status-pill ${getItemStatusClass(item?.status)}`}>{item?.status || '-'}</div>
                  </td>
                  <td>{toNameFromEmail(item?.seller?.email)}</td>
                  <td>{item?.seller?.email || '-'}</td>
                  <td>{toNameFromEmail(item?.buyer?.email)}</td>
                  <td>{item?.buyer?.email || '-'}</td>
                  <td>{formatCurrency(item?.price)}</td>
                  <td>
                    <button
                      className="ride-action-btn danger"
                      onClick={() => handleAdminDelete(item._id)}
                      disabled={busyItemId === item._id}
                      title="Delete Product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ) : activeTab === 'onWebsite' ? (
                <tr key={item._id}>
                  <td>
                    <strong>{item?.title || '-'}</strong>
                    <div className={`item-status-pill ${getItemStatusClass(item?.status)}`}>{item?.status || '-'}</div>
                  </td>
                  <td>{toNameFromEmail(item?.seller?.email)}</td>
                  <td>{item?.seller?.email || '-'}</td>
                  <td>{formatCurrency(item?.price)}</td>
                  <td>
                    <button
                      className="ride-action-btn danger"
                      onClick={() => handleAdminDelete(item._id)}
                      disabled={busyItemId === item._id}
                      title="Delete Product"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={item._id}>
                  <td>
                    <strong>{item?.title || '-'}</strong>
                    <div className={`item-status-pill ${getItemStatusClass(item?.status)}`}>{item?.status || '-'}</div>
                  </td>
                  <td>{toNameFromEmail(item?.seller?.email)}</td>
                  <td>{item?.seller?.email || '-'}</td>
                  <td>{formatCurrency(item?.price)}</td>
                  <td>
                    <div className="ride-action-stack">
                      <button
                        className="ride-action-btn"
                        onClick={() => moderate(item._id, 'approved')}
                        title="Approve"
                        disabled={busyItemId === item._id}
                      >
                        <Check size={14} color="green" />
                      </button>
                      <button
                        className="ride-action-btn"
                        onClick={() => moderate(item._id, 'hold')}
                        title="Hold & Suggest Price"
                        disabled={busyItemId === item._id}
                      >
                        <Pause size={14} color="orange" />
                      </button>
                      <button
                        className="ride-action-btn danger"
                        onClick={() => moderate(item._id, 'rejected')}
                        title="Reject"
                        disabled={busyItemId === item._id}
                      >
                        <Trash2 size={14} color="red" />
                      </button>
                      <button
                        className="ride-action-btn danger"
                        onClick={() => handleAdminDelete(item._id)}
                        title="Delete Product"
                        disabled={busyItemId === item._id}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )) : (
              <tr>
                <td colSpan={activeTab === 'sold' ? '7' : '5'} className="ride-monitor-empty">
                  {loading ? 'Loading products...' : 'No products found for this section.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default ItemModeration;