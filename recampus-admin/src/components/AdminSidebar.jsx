import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingBag, Home, Bike, LogOut, ShieldCheck } from 'lucide-react';

const AdminSidebar = ({ onLogout }) => {
  return (
    <div className="admin-sidebar">
      <div className="admin-brand">
        RC <span style={{color: '#3b82f6'}}>ADMIN</span>
      </div>
      
      <nav className="admin-nav-links">
        <NavLink to="/" className="nav-item">
          <LayoutDashboard size={20} /> Dashboard
        </NavLink>
        <NavLink title="Moderate" to="/moderate-items" className="nav-item">
          <ShoppingBag size={20} /> Item Requests
        </NavLink>

        <NavLink title="Houses" to="/manage-houses" className="nav-item">
          <Home size={20} /> House Listings
        </NavLink>

        <NavLink title="Rides" to="/monitor-rides" className="nav-item">
          <Bike size={20} /> Ride Monitor
        </NavLink>
      </nav>

      <button className="logout-btn" onClick={onLogout}>
        <LogOut size={18} /> Logout
      </button>
    </div>
  );
};

export default AdminSidebar;