import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios'; // Import Axios
import AdminSidebar from './components/AdminSidebar';
import AdminDashboard from './pages/AdminDashboard';
import ItemModeration from './pages/ItemModeration';
import HouseManagement from './pages/HouseManagement';
import RideMonitor from './pages/RideMonitor';
import './Admin.css';

// --- REAL ADMIN LOGIN COMPONENT ---
const AdminLogin = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Send Credentials to Backend
      const res = await axios.post('http://localhost:5000/api/auth/login', formData);

      // 2. Check if user has 'admin' role
      if (res.data.user.roles.includes('admin')) {
        // 3. SAVE THE TOKEN (This fixes the 401 error)
        localStorage.setItem('admin_token', res.data.token);
        
        // 4. Update State
        onLogin(res.data.user);
      } else {
        setError("Access Denied: This account is not an Admin.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Login failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-screen">
      <form className="admin-card auth-card" onSubmit={handleAuth}>
        <div className="logo-box">RC</div>
        <h2>Recampus Admin Panel</h2>
        
        {error && <div style={{color: 'red', marginBottom: '10px', fontSize: '0.9rem'}}>{error}</div>}

        <input 
          type="email" 
          placeholder="Admin Email" 
          onChange={e => setFormData({...formData, email: e.target.value})} 
          required 
        />
        <input 
          type="password" 
          placeholder="Password" 
          onChange={e => setFormData({...formData, password: e.target.value})} 
          required 
        />
        <button className="admin-submit-btn" type="submit" disabled={loading}>
          {loading ? 'Authenticating...' : 'Login to Dashboard'}
        </button>
      </form>
    </div>
  );
};

function App() {
  const [admin, setAdmin] = useState(null);

  // If not logged in, show Login
  if (!admin) {
    return <AdminLogin onLogin={setAdmin} />;
  }

  return (
    <Router>
      <div className="admin-layout">
        <AdminSidebar onLogout={() => {
          localStorage.removeItem('admin_token'); // Clear token on logout
          setAdmin(null);
        }} />
        
        <main className="admin-main">
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/moderate-items" element={<ItemModeration />} />
            <Route path="/manage-houses" element={<HouseManagement />} />
            <Route path="/monitor-rides" element={<RideMonitor />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;