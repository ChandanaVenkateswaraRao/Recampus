import React, { useState } from 'react';
import { loginUser, registerUser, verifyOTP, resendOTP } from '../api/auth';
import {
  ShieldCheck,
  Mail,
  Lock,
  ArrowRight,
  Phone,
  GraduationCap,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import './Auth.css';

const Auth = ({ setToken, setUser }) => {

  const [isLogin, setIsLogin] = useState(true);
  const [verifyMode, setVerifyMode] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone: '',
  });

  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {

    e.preventDefault();
    setError('');

    if (!formData.email.endsWith('@klu.ac.in')) {
      setError('Please use your official @klu.ac.in email.');
      return;
    }

    if (!isLogin && !/^\+?[0-9]{10,15}$/.test((formData.phone || '').trim())) {
      setError('Please enter a valid phone number (10-15 digits).');
      return;
    }

    try {

      if (isLogin) {

        const res = await loginUser(formData);

        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem('token', res.data.token);

      } else {

        await registerUser(formData);

        setVerifyMode(true);

      }

    } catch (err) {

      const message = err.response?.data?.message || 'Authentication failed';

      if (message.toLowerCase().includes('verify')) {
        setVerifyMode(true);
      } else {
        setError(message);
      }

    }

  };

  const handleVerify = async () => {

    try {

      await verifyOTP({
        email: formData.email,
        code: otp
      });

      alert('Email verified successfully. Please login.');
      setVerifyMode(false);
      setIsLogin(true);

    } catch (err) {

      setError(err.response?.data?.message || 'Invalid OTP');

    }

  };

  const handleResend = async () => {

    try {

      await resendOTP({ email: formData.email });
      alert('OTP sent again');

    } catch (err) {

      setError(err.response?.data?.message || 'Failed to resend OTP');

    }

  };

  return (
    <div className="auth-container">

      <div className="auth-visual-panel">

        <div className="auth-visual-brand">
          <div className="brand-logo-mark">
            <Building2 size={18} />
          </div>
          <div>
            <p className="brand-title">ReCampus</p>
            <p className="brand-subtitle">KLU Community Platform</p>
          </div>
        </div>

        <h2>Live smarter on campus.</h2>

        <p className="auth-visual-copy">
          Discover rentals, buy essentials, share rides, and connect with verified KLU
          students in one secure network.
        </p>

        <div className="auth-visual-points">
          <div><CheckCircle2 size={16} /> Verified student-only access</div>
          <div><CheckCircle2 size={16} /> Trusted housing and item listings</div>
          <div><CheckCircle2 size={16} /> Campus-friendly ride sharing</div>
        </div>

      </div>

      <div className="auth-card">

        <div className="auth-header">
          <div className="auth-logo">
            <GraduationCap size={20} />
          </div>

          <h1>
            {verifyMode ? 'Verify Email' : isLogin ? 'Welcome Back' : 'Create Account'}
          </h1>

          <p>
            {verifyMode
              ? 'Enter the OTP sent to your email'
              : isLogin
              ? 'Sign in to continue to your ReCampus dashboard'
              : 'Join the KLU student network with your official email'}
          </p>

        </div>

        {error && <div className="auth-error">{error}</div>}

        {verifyMode ? (

          <div>

            <div className="input-group">
              <Mail size={18} />
              <input
                type="text"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            <button className="auth-btn" onClick={handleVerify}>
              Verify OTP <ArrowRight size={18} />
            </button>

            <button className="auth-link" onClick={handleResend}>
              Resend OTP
            </button>

          </div>

        ) : (

          <form onSubmit={handleSubmit}>

            <div className="input-group">
              <Mail size={18} />
              <input
                type="email"
                placeholder="id_number@klu.ac.in"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="input-group">
              <Lock size={18} />
              <input
                type="password"
                placeholder="Password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            {!isLogin && (
              <div className="input-group">
                <Phone size={18} />
                <input
                  type="tel"
                  placeholder="Phone number"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            )}

            <button type="submit" className="auth-btn">
              {isLogin ? 'Login' : 'Register'} <ArrowRight size={18} />
            </button>

          </form>

        )}

        <div className="auth-footer">
          <button onClick={() => setIsLogin(!isLogin)}>
            {isLogin
              ? "Don't have an account? Register"
              : "Already have an account? Login"}
          </button>
        </div>

        <div className="auth-info-inline">
          <ShieldCheck size={14} />
          <span>Verified Student Platform</span>
        </div>

      </div>

    </div>
  );

};

export default Auth;