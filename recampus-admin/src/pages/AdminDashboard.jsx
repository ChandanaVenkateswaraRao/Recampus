import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, ShoppingBag, Bike, Users, TrendingUp } from 'lucide-react';
import { fetchRideCancellationAnalytics } from '../api/adminApi';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalCommission: 0,
    pendingItems: 0,
    activeRides: 0,
    totalUsers: 0
  });
  const [cancellationInsights, setCancellationInsights] = useState({
    totalCancelled: 0,
    windowDays: 30,
    reasons: [],
    cancelledBy: {}
  });

  useEffect(() => {
    // Fetch stats from backend (you'll need to create this endpoint)
    const fetchStats = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/admin/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
        });
        setStats(res.data);
      } catch (err) { console.error("Error fetching stats"); }
    };
    fetchStats();

    const fetchCancellationInsights = async () => {
      try {
        const res = await fetchRideCancellationAnalytics(30);
        setCancellationInsights(res.data || { totalCancelled: 0, windowDays: 30, reasons: [], cancelledBy: {} });
      } catch (_) {
        setCancellationInsights({ totalCancelled: 0, windowDays: 30, reasons: [], cancelledBy: {} });
      }
    };

    fetchCancellationInsights();
  }, []);

  const cancelledByEntries = Object.entries(cancellationInsights.cancelledBy || {}).sort((a, b) => b[1] - a[1]);
  const maxCancelledBy = Math.max(1, ...cancelledByEntries.map(([, count]) => Number(count) || 0));

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Ecosystem Overview</h1>
        <p>Real-time monitoring of Recampus KLU</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon"><IndianRupee /></div>
          <div className="stat-data">
            <h3>₹{stats.totalCommission.toFixed(2)}</h3>
            <p>Total Commission Earned</p>
          </div>
        </div>

        <div className="stat-card orange">
          <div className="stat-icon"><ShoppingBag /></div>
          <div className="stat-data">
            <h3>{stats.pendingItems}</h3>
            <p>Items Awaiting Approval</p>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon"><Bike /></div>
          <div className="stat-data">
            <h3>{stats.activeRides}</h3>
            <p>Rides in Progress</p>
          </div>
        </div>

        <div className="stat-card slate">
          <div className="stat-icon"><Users /></div>
          <div className="stat-data">
            <h3>{stats.totalUsers}</h3>
            <p>Registered Students</p>
          </div>
        </div>
      </div>

      <div className="admin-recent-activity">
        <h3>Platform Performance</h3>
        <div className="placeholder-chart">
          <TrendingUp size={40} color="#cbd5e1" />
          <p>System is stable. All modules are restricted to @klu.ac.in domain.</p>
        </div>
      </div>

      <div className="admin-recent-activity">
        <h3>Top Cancellation Reasons ({cancellationInsights.windowDays} days)</h3>
        <div className="cancel-analytics-card">
          <div className="cancel-analytics-total">
            Total Cancelled Rides: <strong>{cancellationInsights.totalCancelled}</strong>
          </div>

          {cancelledByEntries.length > 0 && (
            <div className="cancel-by-chart">
              <h4>Cancelled By</h4>
              {cancelledByEntries.map(([label, count]) => {
                const safeCount = Number(count) || 0;
                const widthPercent = Math.max(6, Math.round((safeCount / maxCancelledBy) * 100));
                return (
                  <div key={label} className="cancel-by-row">
                    <div className="cancel-by-meta">
                      <span>{label}</span>
                      <strong>{safeCount}</strong>
                    </div>
                    <div className="cancel-by-track">
                      <div className="cancel-by-fill" style={{ width: `${widthPercent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {Array.isArray(cancellationInsights.reasons) && cancellationInsights.reasons.length > 0 ? (
            <div className="cancel-analytics-list">
              {cancellationInsights.reasons.map((item) => (
                <div key={item.reason} className="cancel-analytics-row">
                  <span>{item.reason}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="cancel-analytics-empty">No cancellation data available yet.</p>
          )}
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;