import React, { useState } from 'react';
import { loginUser, registerUser } from '../api/auth';
import { ShieldCheck, Mail, Lock, ArrowRight, Phone } from 'lucide-react';
import './Auth.css';

const Auth = ({ setToken, setUser }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side Domain Check
    if (!formData.email.endsWith('@klu.ac.in')) {
      setError('Please use your official @klu.ac.in email.');
      return;
    }

    if (!isLogin && !/^\+?[0-9]{10,15}$/.test((formData.phone || '').trim())) {
      setError('Please enter a valid phone number (10-15 digits).');
      return;
    }

    try {
      const res = isLogin ? await loginUser(formData) : await registerUser(formData);
      setToken(res.data.token);
      setUser(res.data.user);
      localStorage.setItem('token', res.data.token);
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">RC</div>
          <h1>{isLogin ? 'Welcome Back' : 'Create Account'}</h1>
          <p>Access the KLU exclusive community</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <Mail size={18} />
            <input 
              type="email" 
              placeholder="id_number@klu.ac.in" 
              required 
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="input-group">
            <Lock size={18} />
            <input 
              type="password" 
              placeholder="Password" 
              required 
              onChange={(e) => setFormData({...formData, password: e.target.value})}
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <Phone size={18} />
              <input
                type="tel"
                placeholder="Phone number"
                required
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          )}

          <button type="submit" className="auth-btn">
            {isLogin ? 'Login' : 'Register'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? "Don't have an account? Register" : "Already have an account? Login"}
          </button>
        </div>
      </div>
      
      <div className="auth-info">
        <ShieldCheck size={14} />
        <span>Verified Student Platform</span>
      </div>
    </div>
  );
};

export default Auth;