import React, { useState } from 'react';
import { ShieldCheck, X, Loader2 } from 'lucide-react';
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
      // Adjusting endpoint based on whether it's an Item or a Ride
      const endpoint = type === 'item' 
        ? 'http://localhost:5000/api/items/verify-handover' 
        : 'http://localhost:5000/api/rides/verify-completion';
      
      const payload = type === 'item' ? { itemId: id, code } : { rideId: id, code };

      const res = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert(res.data.message);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content verification-modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
        <button className="close-btn" onClick={onClose}><X /></button>
        
        <div className="verify-icon" style={{ background: '#f1f5f9', width: '60px', height: '60px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px' }}>
          <ShieldCheck size={32} color="#003366" />
        </div>
        
        <h2>Confirm Completion</h2>
        <p style={{ color: '#64748b' }}>Ask the other party for the code</p>

        <div className="transaction-summary" style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', margin: '20px 0' }}>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>{title}</p>
          <h3 style={{ margin: '5px 0 0', color: '#003366' }}>₹{amount}</h3>
        </div>

        {error && <div style={{ color: '#ef4444', marginBottom: '10px' }}>{error}</div>}

        <form onSubmit={handleVerify}>
          <input 
            type="text" 
            placeholder="Enter Code"
            style={{ width: '100%', padding: '15px', fontSize: '1.5rem', textAlign: 'center', borderRadius: '12px', border: '2px solid #e2e8f0', marginBottom: '15px' }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button type="submit" className="verify-btn" disabled={loading} style={{ width: '100%', background: '#003366', color: 'white', padding: '14px', borderRadius: '10px', border: 'none', fontWeight: 'bold' }}>
            {loading ? 'Verifying...' : 'Release Payout'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default VerificationModal;