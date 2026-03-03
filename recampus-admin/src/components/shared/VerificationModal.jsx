import React, { useState } from 'react';
import { ShieldCheck, X, Loader2, IndianRupee } from 'lucide-react';
import axios from 'axios';

const VerificationModal = ({ type, id, title, amount, onClose, onSuccess }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const endpoint = type === 'item' 
        ? '/api/items/verify-handover' 
        : '/api/rides/verify-completion';
      
      const res = await axios.post(`http://localhost:5000${endpoint}`, {
        [type === 'item' ? 'itemId' : 'rideId']: id,
        code: code
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      onSuccess(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content verification-modal">
        <button className="close-btn" onClick={onClose}><X /></button>
        
        <div className="verify-header">
          <div className="verify-icon">
            <ShieldCheck size={32} color="#003366" />
          </div>
          <h2>Confirm Completion</h2>
          <p>Ask the {type === 'item' ? 'buyer' : 'passenger'} for the code</p>
        </div>

        <div className="transaction-summary">
          <p>{title}</p>
          <h3>₹{amount}</h3>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleVerify}>
          <input 
            type="text" 
            placeholder={type === 'item' ? "6-digit code" : "4-digit code"}
            className="code-input"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <p className="hint">Funds will be released to your wallet instantly upon verification.</p>
          
          <button type="submit" className="verify-btn" disabled={loading}>
            {loading ? <Loader2 className="spin" /> : 'Release Payout'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerificationModal;