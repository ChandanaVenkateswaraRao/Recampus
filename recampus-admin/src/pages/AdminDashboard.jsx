import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { IndianRupee, ShoppingBag, Bike, Users, TrendingUp } from 'lucide-react';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalCommission: 0,
    pendingItems: 0,
    activeRides: 0,
    totalUsers: 0
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
  }, []);

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
    </div>
  );
};

export default AdminDashboard;