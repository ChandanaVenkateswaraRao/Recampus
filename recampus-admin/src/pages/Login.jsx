import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, Loader2 } from 'lucide-react';

const Login = ({ setAdminState }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Call the same login API we used for students
      const res = await axios.post('http://localhost:5000/api/auth/login', { email, password });

      // 2. Check if the user actually has the 'admin' role
      if (res.data.user.roles.includes('admin')) {
        localStorage.setItem('admin_token', res.data.token);
        setAdminState(res.data.user);
      } else {
        setError("Unauthorized: You do not have admin privileges.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid Email or Password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-container">
      <form className="admin-login-card" onSubmit={handleLogin}>
        <div className="admin-logo-circle">RC</div>
        <h2>Admin Portal</h2>
        <p>Enter your KLU admin credentials</p>

        {error && <div className="login-error">{error}</div>}

        <div className="admin-input-group">
          <Mail size={18} />
          <input 
            type="email" 
            placeholder="admin@klu.ac.in" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
          />
        </div>

        <div className="admin-input-group">
          <Lock size={18} />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? <Loader2 className="spin" /> : 'Sign In to Dashboard'}
        </button>
      </form>
    </div>
  );
};

export default Login;